import prisma from './prisma';
import { decryptSecret } from './secretBox';
import { logLeadActivity } from './automation';
import { executeAutomationWorkflows } from './workflows';
import { emitWebhookEvent } from './integrations';
import { createNotification, getManagerIds, leadHref } from './notifications';
import { getSubscriptionAccess } from './subscription';
import { planHasFeature } from './plans';
import { getOrCreateConversation, sendUnifiedMessage } from './inbox';
import {
  allocate,
  chooseMatch,
  newPaymentRef,
  newSecretToken,
  reminderStage,
  stkPush,
  stkQuery,
  type C2BPayment,
  type DarajaCredentials,
  type StkResult,
} from './mpesa';

type Account = {
  id: string;
  organizationId: string;
  type: string;
  shortcode: string;
  tillNumber: string | null;
  environment: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  callbackToken: string;
};

export const publicBaseUrl = () => (process.env.PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');

export function credentials(a: Account): DarajaCredentials {
  return {
    environment: a.environment,
    type: a.type,
    shortcode: a.shortcode,
    tillNumber: a.tillNumber,
    consumerKey: decryptSecret(a.consumerKey) || '',
    consumerSecret: decryptSecret(a.consumerSecret) || '',
    passkey: decryptSecret(a.passkey) || '',
  };
}

// Paths avoid the words "mpesa"/"safaricom": Daraja rejects callback URLs that contain them.
export const callbackUrl = (a: { callbackToken: string }, kind: 'stk' | 'confirm' | 'validate') =>
  `${publicBaseUrl()}/api/payments/callback/${a.callbackToken}/${kind}`;
export const payLinkUrl = (token: string) => `${publicBaseUrl()}/pay/${token}`;

/** The account a workspace collects with: the requested one, else the oldest connected. */
export async function getCollectionAccount(organizationId: string, accountId?: string | null) {
  return prisma.mpesaAccount.findFirst({
    where: { organizationId, ...(accountId ? { id: accountId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

/** Every lead gets a short account number the first time it is needed. */
export async function ensurePaymentRef(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { paymentRef: true } });
  if (lead?.paymentRef) return lead.paymentRef;
  for (let i = 0; i < 5; i++) {
    try {
      const ref = newPaymentRef();
      await prisma.lead.update({ where: { id: leadId }, data: { paymentRef: ref } });
      return ref;
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // collision: try another code
    }
  }
  throw new Error('Could not create a payment reference. Please try again.');
}

/** Sends an STK prompt for an existing payment row (a new request or a link the customer opened). */
export async function sendStkPrompt(paymentId: string, phone: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { mpesaAccount: true } });
  if (!payment?.mpesaAccount) throw new Error('No M-Pesa account is connected for this payment.');
  const ref = payment.accountRef || (payment.leadId ? await ensurePaymentRef(payment.leadId) : 'PAYMENT');
  const result = await stkPush(credentials(payment.mpesaAccount), {
    phone,
    amount: payment.amount,
    accountRef: ref,
    description: payment.description || 'Payment',
    callbackUrl: callbackUrl(payment.mpesaAccount, 'stk'),
  });
  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'PENDING', phone, accountRef: ref, checkoutRequestId: result.checkoutRequestId, resultDesc: null },
  });
}

/** Marks a payment paid and runs everything that follows: timeline, instalments, automations, notifications. */
export async function markPaid(paymentId: string, data: { receipt?: string | null; phone?: string | null; amount?: number; paidAt?: Date; leadId?: string | null; matchedBy?: string | null; payerName?: string | null; resultDesc?: string }) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'PAID',
      mpesaReceipt: data.receipt || undefined,
      phone: data.phone || undefined,
      amount: data.amount || undefined,
      paidAt: data.paidAt || new Date(),
      leadId: data.leadId === undefined ? undefined : data.leadId,
      matchedBy: data.matchedBy === undefined ? undefined : data.matchedBy,
      payerName: data.payerName || undefined,
      resultDesc: data.resultDesc || 'Paid',
    },
  });
  if (payment.leadId) await afterPaymentMatched(payment.id);
  else await notifyUnmatched(payment.organizationId, payment.amount);
  return payment;
}

/** Runs once a paid payment is linked to a customer (automatically or by hand). */
export async function afterPaymentMatched(paymentId: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.leadId || p.status !== 'PAID') return;
  const lead = await prisma.lead.findUnique({ where: { id: p.leadId }, select: { id: true, contactName: true, assignedToId: true } });
  if (!lead) return;
  await logLeadActivity(prisma, lead.id, 'PAYMENT', `M-Pesa payment received: KES ${p.amount.toLocaleString('en-US')}`, {
    paymentId: p.id,
    receipt: p.mpesaReceipt,
    amount: p.amount,
  });
  await prisma.lead.update({ where: { id: lead.id }, data: { lastContact: new Date() } });
  await applyToPlans(p.organizationId, lead.id, p.amount);
  const recipients = lead.assignedToId ? [lead.assignedToId] : await getManagerIds(p.organizationId);
  await Promise.all(recipients.map((userId) => createNotification({ userId, type: 'PAYMENT_RECEIVED', title: 'Payment received', message: `${lead.contactName} paid KES ${p.amount.toLocaleString('en-US')} via M-Pesa.`, href: leadHref(lead.id) })));
  await executeAutomationWorkflows({ organizationId: p.organizationId, triggerType: 'PAYMENT_RECEIVED', leadId: lead.id, eventId: `payment:${p.id}` }).catch((e) => console.error('PAYMENT_RECEIVED workflow failed', e));
  await emitWebhookEvent(p.organizationId, 'payment.received', { id: p.id, leadId: lead.id, amount: p.amount, currency: 'KES', receipt: p.mpesaReceipt, phone: p.phone, paidAt: p.paidAt }).catch(() => undefined);
}

async function notifyUnmatched(organizationId: string, amount: number) {
  const managers = await getManagerIds(organizationId);
  await Promise.all(managers.map((userId) => createNotification({ userId, type: 'PAYMENT_UNMATCHED', title: 'Payment needs a customer', message: `KES ${amount.toLocaleString('en-US')} arrived on M-Pesa and could not be matched automatically.`, href: '/payments?tab=unmatched' })));
}

/** Applies a payment to the customer's active instalment plans, oldest instalment first. */
export async function applyToPlans(organizationId: string, leadId: string, amount: number) {
  const plans = await prisma.paymentPlan.findMany({
    where: { organizationId, leadId, status: 'ACTIVE' },
    include: { installments: { orderBy: { dueDate: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  let left = amount;
  for (const plan of plans) {
    if (left <= 0) break;
    const { updates, leftover } = allocate(plan.installments, left);
    left = leftover;
    for (const u of updates) await prisma.installment.update({ where: { id: u.id }, data: { paidAmount: u.paidAmount } });
    const paid = plan.installments.every((i) => (updates.find((u) => u.id === i.id)?.paidAmount ?? i.paidAmount) >= i.amount);
    if (paid) {
      await prisma.paymentPlan.update({ where: { id: plan.id }, data: { status: 'COMPLETED' } });
      await logLeadActivity(prisma, leadId, 'PAYMENT', `Instalment plan fully paid: ${plan.title}`, { planId: plan.id });
      await executeAutomationWorkflows({ organizationId, triggerType: 'PLAN_COMPLETED', leadId, eventId: `plan-completed:${plan.id}` }).catch(() => undefined);
    }
  }
}

/** Handles the STK result Safaricom posts back. Only payments sent from this account are touched. */
export async function handleStkResult(accountId: string, r: StkResult) {
  const payment = await prisma.payment.findFirst({ where: { checkoutRequestId: r.checkoutRequestId, mpesaAccountId: accountId } });
  if (!payment) return null;
  if (r.resultCode === 0) {
    if (payment.status === 'PAID') {
      // A status check may have marked it paid first; fill in the receipt.
      if (!payment.mpesaReceipt && r.receipt) await prisma.payment.update({ where: { id: payment.id }, data: { mpesaReceipt: r.receipt } }).catch(() => undefined);
      return payment;
    }
    return markPaid(payment.id, { receipt: r.receipt, phone: r.phone, amount: r.amount, matchedBy: payment.leadId ? 'REQUEST' : null });
  }
  if (payment.status !== 'PENDING') return payment;
  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: r.resultCode === 1032 ? 'CANCELLED' : 'FAILED', resultDesc: r.resultDesc },
  });
}

/** For prompts still pending after a short wait, ask Safaricom directly (callbacks cannot reach local dev). */
export async function refreshPendingPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { mpesaAccount: true } });
  if (!payment || payment.status !== 'PENDING' || !payment.checkoutRequestId || !payment.mpesaAccount) return payment;
  if (Date.now() - payment.updatedAt.getTime() < 15000) return payment;
  try {
    const q = await stkQuery(credentials(payment.mpesaAccount), payment.checkoutRequestId);
    if (!q) return payment;
    await handleStkResult(payment.mpesaAccount.id, { checkoutRequestId: payment.checkoutRequestId, resultCode: q.resultCode, resultDesc: q.resultDesc });
  } catch (e) {
    console.warn('STK status check failed', (e as Error).message);
  }
  return prisma.payment.findUnique({ where: { id: paymentId } });
}

/** Records money paid straight to the Paybill/Till and matches it to a customer. Idempotent per receipt. */
export async function recordC2BPayment(account: Account, c: C2BPayment) {
  const existing = await prisma.payment.findFirst({ where: { organizationId: account.organizationId, mpesaReceipt: c.receipt } });
  if (existing) return existing;
  const orgId = account.organizationId;

  const byReference = c.billRef
    ? (await prisma.lead.findMany({ where: { organizationId: orgId, paymentRef: c.billRef.toUpperCase() }, select: { id: true } })).map((l) => l.id)
    : [];
  // Safaricom often masks or hashes the payer's number in C2B; only a full number is used.
  const fullPhone = /^254\d{9}$/.test(c.phone) ? c.phone : null;
  const byPhone = fullPhone
    ? (await prisma.lead.findMany({ where: { organizationId: orgId, phone: { contains: fullPhone.slice(-9) } }, select: { id: true }, take: 5 })).map((l) => l.id)
    : [];
  const since = new Date(Date.now() - 14 * 86_400_000);
  const byAmount = (await prisma.payment.findMany({
    where: { organizationId: orgId, amount: c.amount, status: { in: ['REQUESTED', 'PENDING'] }, leadId: { not: null }, createdAt: { gte: since } },
    select: { id: true, leadId: true },
    take: 5,
  })).map((p) => ({ paymentId: p.id, leadId: p.leadId as string }));

  const match = chooseMatch({ byReference, byPhone, byAmount });
  const paid = { receipt: c.receipt, phone: c.phone, amount: c.amount, paidAt: c.paidAt, payerName: c.payerName, leadId: match?.leadId ?? null, matchedBy: match?.matchedBy ?? null };

  // Close the customer's open request for the same amount instead of leaving it "awaiting payment".
  const openRequest = match
    ? match.requestId
      ? { id: match.requestId }
      : await prisma.payment.findFirst({ where: { organizationId: orgId, leadId: match.leadId, amount: c.amount, status: { in: ['REQUESTED', 'PENDING'] } }, orderBy: { createdAt: 'desc' }, select: { id: true } })
    : null;
  if (openRequest) return markPaid(openRequest.id, paid);

  const created = await prisma.payment.create({
    data: { organizationId: orgId, mpesaAccountId: account.id, source: 'C2B', status: 'PENDING', amount: c.amount, accountRef: c.billRef || null, description: 'Paid to Paybill/Till' },
  });
  return markPaid(created.id, paid);
}

/** Creates payment links and sends instalment reminders. Run once a day from the cron. */
export async function runPaymentReminders(now = new Date()) {
  const due = await prisma.installment.findMany({
    where: { plan: { status: 'ACTIVE' }, dueDate: { lte: new Date(now.getTime() + 4 * 86_400_000) } },
    include: { plan: { include: { lead: true, organization: { select: { id: true, name: true, plan: true } } } } },
    take: 500,
  });
  let sent = 0;
  for (const inst of due) {
    const remaining = inst.amount - inst.paidAmount;
    const stage = reminderStage(inst.dueDate, now);
    const done = Array.isArray(inst.remindersSent) ? (inst.remindersSent as string[]) : [];
    if (remaining <= 0 || !stage || done.includes(stage)) continue;
    const org = inst.plan.organization;
    if (!planHasFeature(org.plan, 'instalment_plans') || !(await getSubscriptionAccess(org.id)).allowed) continue;

    // Record the stage first so a failed send is not retried every day.
    await prisma.installment.update({ where: { id: inst.id }, data: { remindersSent: [...done, stage] } });
    if (stage === 'OVERDUE') {
      await executeAutomationWorkflows({ organizationId: org.id, triggerType: 'PAYMENT_OVERDUE', leadId: inst.plan.leadId, eventId: `overdue:${inst.id}` }).catch(() => undefined);
    }
    if (await sendInstalmentReminder(inst, remaining, stage, org.name)) sent++;
  }
  return { checked: due.length, sent };
}

async function sendInstalmentReminder(inst: any, remaining: number, stage: string, businessName: string) {
  const lead = inst.plan.lead;
  const orgId = inst.plan.organizationId;
  let link = '';
  const account = await getCollectionAccount(orgId);
  if (account) {
    const token = newSecretToken();
    await prisma.payment.create({
      data: { organizationId: orgId, mpesaAccountId: account.id, leadId: lead.id, source: 'LINK', status: 'REQUESTED', amount: remaining, description: inst.plan.title.slice(0, 60), linkToken: token, accountRef: await ensurePaymentRef(lead.id) },
    });
    link = payLinkUrl(token);
  }
  const date = inst.dueDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const first = (lead.contactName || '').split(' ')[0] || 'there';
  const opening =
    stage === 'BEFORE' ? `a friendly reminder that KES ${remaining.toLocaleString('en-US')} for "${inst.plan.title}" is due on ${date}.`
    : stage === 'DUE' ? `KES ${remaining.toLocaleString('en-US')} for "${inst.plan.title}" is due today.`
    : `KES ${remaining.toLocaleString('en-US')} for "${inst.plan.title}" was due on ${date} and is still outstanding.`;
  const content = `Hi ${first}, ${opening}${link ? `\n\nPay by M-Pesa here: ${link}` : ''}\n\nThank you,\n${businessName}`;

  const conversation = await getOrCreateConversation({ organizationId: orgId, leadId: lead.id, channel: lead.email ? 'EMAIL' : 'WHATSAPP' });
  for (const channel of [lead.email ? 'EMAIL' : null, lead.phone ? 'WHATSAPP' : null].filter(Boolean) as Array<'EMAIL' | 'WHATSAPP'>) {
    try {
      const result = await sendUnifiedMessage({ organizationId: orgId, conversationId: conversation.id, channel, content, subject: `Payment reminder: ${inst.plan.title}`, senderName: businessName });
      if (result.success) {
        await logLeadActivity(prisma, lead.id, 'PAYMENT', `Payment reminder sent (${stage.toLowerCase()}) by ${channel === 'EMAIL' ? 'email' : 'WhatsApp'}`, { installmentId: inst.id, amount: remaining });
        return true;
      }
    } catch (e) {
      console.warn('Reminder send failed', (e as Error).message);
    }
  }
  await logLeadActivity(prisma, lead.id, 'PAYMENT', `Payment reminder could not be sent (${stage.toLowerCase()}): connect email or WhatsApp`, { installmentId: inst.id });
  return false;
}
