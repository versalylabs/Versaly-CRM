import prisma from './prisma';
import { normalizePhone } from './phone';

/**
 * SMS through the VersalyLabs Africa's Talking account, paid for with prepaid credits per workspace.
 * 1 credit = 1 SMS segment (160 GSM characters, or 153 per part when longer; 70/67 with emoji or other unicode).
 */

export const SMS_PACKS = [
  { credits: 500, priceKes: 500 },
  { credits: 2000, priceKes: 1900 },
  { credits: 10000, priceKes: 9000 },
] as const;

export const smsConfigured = () => Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);

const GSM = /^[\n\r @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

/** Credits a message costs. */
export function smsSegments(text: string): number {
  if (!text) return 0;
  const gsm = GSM.test(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

/** Africa's Talking wants +2547XXXXXXXX. */
export function smsNumber(input: unknown): string | null {
  const p = normalizePhone(input);
  return p ? `+${p}` : null;
}

/** Takes credits only if the balance covers them (atomic), and records it. Returns false when short. */
export async function spendCredits(organizationId: string, credits: number, note: string, userId?: string | null) {
  const updated = await prisma.organization.updateMany({ where: { id: organizationId, smsCredits: { gte: credits } }, data: { smsCredits: { decrement: credits } } });
  if (!updated.count) return false;
  await prisma.smsCreditLedger.create({ data: { organizationId, change: -credits, reason: 'SEND', note: note.slice(0, 120), createdById: userId || null } });
  return true;
}

export async function refundCredits(organizationId: string, credits: number, note: string) {
  await prisma.$transaction([
    prisma.organization.update({ where: { id: organizationId }, data: { smsCredits: { increment: credits } } }),
    prisma.smsCreditLedger.create({ data: { organizationId, change: credits, reason: 'REFUND', note: note.slice(0, 120) } }),
  ]);
}

/** Adds purchased credits once per payment reference. */
export async function addPurchasedCredits(organizationId: string, credits: number, reference: string) {
  const existing = await prisma.smsCreditLedger.findUnique({ where: { reference } });
  if (existing) return existing;
  const [entry] = await prisma.$transaction([
    prisma.smsCreditLedger.create({ data: { organizationId, change: credits, reason: 'PURCHASE', reference, note: `Bought ${credits} SMS credits` } }),
    prisma.organization.update({ where: { id: organizationId }, data: { smsCredits: { increment: credits } } }),
  ]);
  return entry;
}

/** Sends one SMS. Charges credits first and refunds them if Africa's Talking rejects the message. */
export async function sendSms(input: { organizationId: string; to: string; message: string; userId?: string | null }): Promise<{ ok: boolean; error?: string; messageId?: string; credits: number }> {
  const to = smsNumber(input.to);
  const credits = smsSegments(input.message);
  if (!to) return { ok: false, error: 'Invalid phone number.', credits: 0 };
  if (!input.message.trim()) return { ok: false, error: 'Message is empty.', credits: 0 };
  if (!smsConfigured()) return { ok: false, error: 'SMS is not available yet. Please contact VersalyLabs support.', credits: 0 };
  if (!(await spendCredits(input.organizationId, credits, `SMS to ${to}`, input.userId))) {
    return { ok: false, error: 'Not enough SMS credits. Buy more in Settings → Messaging.', credits: 0 };
  }

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { smsSenderId: true } });
  const sandbox = process.env.AT_USERNAME === 'sandbox';
  const body = new URLSearchParams({ username: process.env.AT_USERNAME!, to, message: input.message });
  const from = org?.smsSenderId || process.env.AT_SENDER_ID;
  if (from) body.set('from', from);
  try {
    const res = await fetch(`https://api.${sandbox ? 'sandbox.' : ''}africastalking.com/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: process.env.AT_API_KEY!, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const json: any = await res.json().catch(() => ({}));
    const r = json?.SMSMessageData?.Recipients?.[0];
    if (!res.ok || !r || ![100, 101, 102].includes(Number(r.statusCode))) {
      await refundCredits(input.organizationId, credits, `Failed SMS to ${to}`);
      return { ok: false, error: r?.status || json?.SMSMessageData?.Message || 'The SMS could not be sent.', credits: 0 };
    }
    return { ok: true, messageId: r.messageId, credits };
  } catch (e: any) {
    await refundCredits(input.organizationId, credits, `Failed SMS to ${to}`);
    return { ok: false, error: e?.message || 'The SMS could not be sent.', credits: 0 };
  }
}
