import crypto from 'crypto';
import prisma from './prisma';
import { PLANS, PLAN_LIMITS, normalizePlan, type PlanKey } from './plans';
import { decryptSecret, encryptSecret } from './secretBox';

/**
 * Subscription billing through Paystack (Kenya: card + M-Pesa).
 * Every period is a one-off payment. A card payment returns a reusable authorization, which we
 * keep (encrypted) to charge the card automatically at renewal; M-Pesa payers renew from a
 * reminder email. Paystack amounts are in the currency's subunit (KES x 100).
 */
export type Interval = 'month' | 'year';
export const GRACE_DAYS = 3;
const DAY = 86_400_000;

export const normalizeInterval = (v: unknown): Interval => (v === 'month' ? 'month' : 'year');

/** Total KES charged for one period: monthly price, or 12 x the discounted annual monthly price. */
export function priceFor(plan: PlanKey, interval: Interval): number {
  const p = PLANS[plan].priceKes;
  return interval === 'month' ? p.monthly : p.annual * 12;
}

/** A renewal extends from the current end if it is still in the future, otherwise from now. */
export function nextPeriod(currentEnd: Date | null, now: Date, interval: Interval): { start: Date; end: Date } {
  const start = currentEnd && currentEnd > now ? new Date(currentEnd) : new Date(now);
  const end = new Date(start);
  if (interval === 'month') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}

/** Whole days from `now` until `date` (negative when past). */
export const daysUntil = (date: Date, now: Date) => Math.ceil((date.getTime() - now.getTime()) / DAY);

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function paystack<T = any>(path: string, body?: unknown): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('Payments are not configured yet (PAYSTACK_SECRET_KEY is missing).');
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) throw new Error(json?.message || `Paystack request failed (${res.status}).`);
  return json.data as T;
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret = process.env.PAYSTACK_SECRET_KEY): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(crypto.createHmac('sha512', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const newReference = (orgId: string) => `vl_${orgId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

/** Starts a Paystack checkout (card or M-Pesa) and returns the hosted payment page URL. */
export async function startCheckout(input: { organizationId: string; email: string; plan: PlanKey; interval: Interval; callbackUrl: string }) {
  const amount = priceFor(input.plan, input.interval);
  const data = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    email: input.email,
    amount: amount * 100,
    currency: 'KES',
    reference: newReference(input.organizationId),
    callback_url: input.callbackUrl,
    channels: ['card', 'mobile_money'],
    metadata: { organizationId: input.organizationId, plan: input.plan, interval: input.interval },
  });
  return data.authorization_url;
}

export async function verifyTransaction(reference: string) {
  return paystack<any>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

type SavedCard = { code: string; email: string; last4?: string; brand?: string; exp?: string };

export function readSavedCard(encrypted: string | null): SavedCard | null {
  try {
    const raw = decryptSecret(encrypted);
    return raw ? (JSON.parse(raw) as SavedCard) : null;
  } catch {
    return null;
  }
}

/**
 * Records a successful Paystack charge: creates the invoice and extends the workspace's plan.
 * Idempotent by Paystack reference, so the redirect and the webhook can both call it safely.
 * Returns the invoice, or null when the charge is not a valid successful payment.
 */
export async function applyPaystackCharge(tx: any) {
  if (!tx || tx.status !== 'success' || tx.currency !== 'KES' || !tx.reference) return null;
  const existing = await prisma.invoice.findUnique({ where: { reference: tx.reference } });
  if (existing) return existing;

  const meta = typeof tx.metadata === 'string' ? safeJson(tx.metadata) : tx.metadata || {};
  const plan = normalizePlan(meta.plan, 'STARTER');
  const interval = normalizeInterval(meta.interval);
  const org = meta.organizationId ? await prisma.organization.findUnique({ where: { id: String(meta.organizationId) } }) : null;
  if (!org) return null;
  // The amount must match the price for the plan and period being bought (guards against tampering).
  const amountKes = Math.round(Number(tx.amount) / 100);
  if (amountKes < priceFor(plan, interval)) return null;

  const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
  // shortcut: a plan change mid-period takes effect now and adds the new period after any time left (no proration); add proration if customers switch plans often.
  const period = nextPeriod(org.currentPeriodEnd, paidAt, interval);
  const auth = tx.authorization;
  const card: SavedCard | null =
    tx.channel === 'card' && auth?.reusable && auth?.authorization_code
      ? { code: auth.authorization_code, email: tx.customer?.email || '', last4: auth.last4, brand: auth.brand, exp: `${auth.exp_month}/${auth.exp_year}` }
      : null;
  const limits = PLAN_LIMITS[plan];

  const [invoice] = await prisma.$transaction([
    prisma.invoice.create({
      data: {
        organizationId: org.id,
        number: `VL-${paidAt.toISOString().slice(0, 10).replace(/-/g, '')}-${tx.reference.slice(-6).toUpperCase()}`,
        reference: tx.reference,
        plan,
        interval,
        amountKes,
        status: 'paid',
        channel: tx.channel || null,
        periodStart: period.start,
        periodEnd: period.end,
        paidAt,
      },
    }),
    prisma.organization.update({
      where: { id: org.id },
      data: {
        plan,
        planStatus: 'active',
        billingInterval: interval,
        currentPeriodEnd: period.end,
        leadLimit: limits.leadLimit,
        seatLimit: limits.seatLimit,
        automationRunLimit: limits.automationRunLimit,
        paystackCustomerCode: tx.customer?.customer_code || org.paystackCustomerCode,
        ...(card ? { paystackCard: encryptSecret(JSON.stringify(card)), cancelAtPeriodEnd: false } : {}),
      },
    }),
  ]);
  return invoice;
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** Charges the saved card for the next period. Returns the invoice, or null if the charge failed. */
export async function chargeSavedCard(org: { id: string; plan: string; billingInterval: string | null; paystackCard: string | null }) {
  const card = readSavedCard(org.paystackCard);
  if (!card) return null;
  const plan = normalizePlan(org.plan, 'STARTER');
  const interval = normalizeInterval(org.billingInterval);
  const tx = await paystack<any>('/transaction/charge_authorization', {
    authorization_code: card.code,
    email: card.email,
    amount: priceFor(plan, interval) * 100,
    currency: 'KES',
    reference: newReference(org.id),
    metadata: { organizationId: org.id, plan, interval, renewal: true },
  });
  return applyPaystackCharge(tx);
}

const TRIAL_DAYS = 14;

/** Which reminder (if any) applies today. Pure, so it is unit-tested; the cron runs once a day, so each fires once. */
export function billingNotice(org: {
  planStatus: string;
  createdAt: Date;
  currentPeriodEnd: Date | null;
  hasCard: boolean;
  autoRenew: boolean;
}, now: Date): null | { kind: 'trial' | 'renewal' | 'card-renewal'; daysLeft: number } {
  if (org.planStatus === 'trialing') {
    const left = daysUntil(new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY), now);
    return [7, 2, 0].includes(left) ? { kind: 'trial', daysLeft: left } : null;
  }
  if (org.planStatus === 'active' && org.currentPeriodEnd) {
    const left = daysUntil(org.currentPeriodEnd, now);
    if (org.hasCard && org.autoRenew) return left === 3 ? { kind: 'card-renewal', daysLeft: left } : null;
    return [7, 3, 1].includes(left) ? { kind: 'renewal', daysLeft: left } : null;
  }
  return null;
}

async function emailAdmins(organizationId: string, subject: string, text: string) {
  const { sendEmail } = await import('./email');
  const admins = await prisma.user.findMany({ where: { organizationId, role: 'ADMIN', isActive: true }, select: { email: true } });
  for (const a of admins) await sendEmail({ to: a.email, subject, text }).catch((e) => console.error('Billing email failed', e));
}

/** Daily: renew due subscriptions, mark unpaid ones past due after the grace period, send reminders. */
export async function runBillingCycle(now = new Date(), baseUrl = process.env.NEXTAUTH_URL || '') {
  const billingUrl = `${baseUrl.replace(/\/$/, '')}/settings/billing`;
  const stats = { renewed: 0, failed: 0, pastDue: 0, reminders: 0 };

  // 1. Periods that have ended: charge saved cards; otherwise read-only after the grace period.
  const due = await prisma.organization.findMany({ where: { planStatus: 'active', currentPeriodEnd: { lte: now }, suspendedAt: null } });
  for (const org of due) {
    const graceOver = now.getTime() - (org.currentPeriodEnd as Date).getTime() > GRACE_DAYS * DAY;
    if (org.paystackCard && !org.cancelAtPeriodEnd) {
      const invoice = await chargeSavedCard(org).catch((e) => {
        console.error('Renewal charge failed', org.id, e);
        return null;
      });
      if (invoice) {
        stats.renewed++;
        continue;
      }
      stats.failed++;
    }
    if (graceOver) {
      await prisma.organization.update({ where: { id: org.id }, data: { planStatus: 'past_due' } });
      await emailAdmins(org.id, 'Your VersalyLabs workspace is now read-only', `Your plan ended and we could not take payment, so your workspace is read-only. Your data is safe. Pay here to switch everything back on: ${billingUrl}`);
      stats.pastDue++;
    }
  }

  // 2. Reminders for trials and upcoming renewals.
  const upcoming = await prisma.organization.findMany({
    where: { suspendedAt: null, planStatus: { in: ['trialing', 'active'] } },
    select: { id: true, planStatus: true, createdAt: true, currentPeriodEnd: true, paystackCard: true, cancelAtPeriodEnd: true },
  });
  for (const org of upcoming) {
    const notice = billingNotice({ ...org, hasCard: Boolean(org.paystackCard), autoRenew: !org.cancelAtPeriodEnd }, now);
    if (!notice) continue;
    const when = notice.daysLeft === 0 ? 'today' : `in ${notice.daysLeft} day${notice.daysLeft === 1 ? '' : 's'}`;
    if (notice.kind === 'trial') {
      await emailAdmins(org.id, notice.daysLeft === 0 ? 'Your VersalyLabs free trial ends today' : `Your VersalyLabs free trial ends ${when}`,
        `Your free trial ends ${when}. Choose a plan to keep your leads, inbox and automations running. You can pay by M-Pesa or card: ${billingUrl}`);
    } else if (notice.kind === 'card-renewal') {
      await emailAdmins(org.id, `Your VersalyLabs plan renews ${when}`, `We will charge your saved card ${when} to renew your plan. To change plan or turn off automatic renewal: ${billingUrl}`);
    } else {
      await emailAdmins(org.id, `Your VersalyLabs plan ends ${when}`, `Your plan ends ${when}. Renew by M-Pesa or card to keep everything running: ${billingUrl}`);
    }
    stats.reminders++;
  }
  return stats;
}
