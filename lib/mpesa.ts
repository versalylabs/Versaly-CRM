import crypto from 'crypto';
import { normalizePhone } from './phone';

/**
 * Safaricom Daraja (M-Pesa) client plus the pure helpers the payments module uses.
 * Everything that touches the database lives in lib/payments.ts.
 */

export type DarajaCredentials = {
  environment: string; // sandbox | production
  type: string; // PAYBILL | TILL
  shortcode: string;
  tillNumber?: string | null;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
};

export { SANDBOX_SHORTCODE, SANDBOX_PASSKEY } from './mpesaConstants';

const DAY = 86_400_000;

export const darajaBase = (environment: string) =>
  environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

/** Daraja timestamps are Kenya time (UTC+3), formatted YYYYMMDDHHmmss. */
export function darajaTimestamp(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

export const stkPassword = (shortcode: string, passkey: string, timestamp: string) =>
  Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

/** An M-Pesa-capable Kenyan mobile number as 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function mpesaPhone(input: unknown): string | null {
  const p = normalizePhone(input);
  return p && /^254[17]\d{8}$/.test(p) ? p : null;
}

/** Short account number customers can type at a Paybill (no 0/O/1/I to avoid typos). */
export function newPaymentRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

export const newSecretToken = () => crypto.randomBytes(24).toString('hex');

/* ------------------------------- callbacks ------------------------------- */

export type StkResult = {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  receipt?: string;
  phone?: string;
};

/** Parses the STK Push result Safaricom posts to our callback URL. */
export function parseStkCallback(body: any): StkResult | null {
  const cb = body?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;
  const items: Array<{ Name: string; Value?: unknown }> = cb.CallbackMetadata?.Item || [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value;
  return {
    checkoutRequestId: String(cb.CheckoutRequestID),
    resultCode: Number(cb.ResultCode),
    resultDesc: String(cb.ResultDesc || ''),
    amount: get('Amount') !== undefined ? Math.round(Number(get('Amount'))) : undefined,
    receipt: get('MpesaReceiptNumber') ? String(get('MpesaReceiptNumber')) : undefined,
    phone: get('PhoneNumber') ? String(get('PhoneNumber')) : undefined,
  };
}

export type C2BPayment = {
  receipt: string;
  amount: number;
  billRef: string;
  phone: string; // may be masked or hashed by Safaricom
  payerName: string;
  shortcode: string;
  paidAt: Date;
};

/** Parses a C2B confirmation (money paid straight to the Paybill or Till). */
export function parseC2BConfirmation(body: any): C2BPayment | null {
  if (!body?.TransID || body?.TransAmount === undefined) return null;
  const t = String(body.TransTime || '');
  // TransTime is Kenya time, YYYYMMDDHHmmss.
  const paidAt = /^\d{14}$/.test(t)
    ? new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10) - 3, +t.slice(10, 12), +t.slice(12, 14)))
    : new Date();
  return {
    receipt: String(body.TransID),
    amount: Math.round(Number(body.TransAmount)),
    billRef: String(body.BillRefNumber || '').trim(),
    phone: String(body.MSISDN || ''),
    payerName: [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(' ').trim(),
    shortcode: String(body.BusinessShortCode || ''),
    paidAt,
  };
}

/* ------------------------------- matching ------------------------------- */

export type MatchCandidates = {
  /** Leads whose payment reference equals the account number typed. */
  byReference: string[];
  /** Leads whose phone matches the payer's (empty when Safaricom masks the number). */
  byPhone: string[];
  /** Open payment requests with exactly this amount: [paymentId, leadId]. */
  byAmount: Array<{ paymentId: string; leadId: string }>;
};

export type MatchResult = { leadId: string; matchedBy: 'REFERENCE' | 'PHONE' | 'AMOUNT'; requestId?: string } | null;

/** Reference first, then phone, then amount; each only when it points at exactly one customer. */
export function chooseMatch(c: MatchCandidates): MatchResult {
  const one = (ids: string[]) => (new Set(ids).size === 1 ? ids[0] : null);
  const ref = one(c.byReference);
  if (ref) return { leadId: ref, matchedBy: 'REFERENCE' };
  const phone = one(c.byPhone);
  if (phone) return { leadId: phone, matchedBy: 'PHONE' };
  if (c.byAmount.length === 1) return { leadId: c.byAmount[0].leadId, matchedBy: 'AMOUNT', requestId: c.byAmount[0].paymentId };
  return null;
}

/* ----------------------------- instalments ----------------------------- */

export type ScheduleInput = { total: number; deposit: number; count: number; firstDue: Date; frequency: 'monthly' | 'weekly' };

/** Deposit due on the first date (if any), then `count` equal instalments; the last one absorbs rounding. */
export function buildSchedule({ total, deposit, count, firstDue, frequency }: ScheduleInput): Array<{ dueDate: Date; amount: number }> {
  if (!Number.isInteger(total) || total <= 0) throw new Error('Total must be a whole number of shillings above 0.');
  if (!Number.isInteger(deposit) || deposit < 0 || deposit >= total) throw new Error('Deposit must be at least 0 and less than the total.');
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('Choose between 1 and 120 instalments.');
  const rows: Array<{ dueDate: Date; amount: number }> = [];
  const step = (i: number) => {
    const d = new Date(firstDue);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7 * i);
    else d.setMonth(d.getMonth() + i);
    return d;
  };
  let offset = 0;
  if (deposit > 0) {
    rows.push({ dueDate: step(0), amount: deposit });
    offset = 1;
  }
  const rest = total - deposit;
  const each = Math.floor(rest / count);
  for (let i = 0; i < count; i++) {
    rows.push({ dueDate: step(i + offset), amount: i === count - 1 ? rest - each * (count - 1) : each });
  }
  return rows;
}

/** Pays the oldest instalments first. Returns the new paidAmount per changed instalment and what was left over. */
export function allocate(installments: Array<{ id: string; amount: number; paidAmount: number }>, amount: number) {
  let left = amount;
  const updates: Array<{ id: string; paidAmount: number }> = [];
  for (const i of installments) {
    if (left <= 0) break;
    const due = i.amount - i.paidAmount;
    if (due <= 0) continue;
    const pay = Math.min(due, left);
    updates.push({ id: i.id, paidAmount: i.paidAmount + pay });
    left -= pay;
  }
  return { updates, leftover: left };
}

export type AgeingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';
export function ageingBucket(dueDate: Date, now = new Date()): AgeingBucket {
  const late = Math.floor((now.getTime() - dueDate.getTime()) / DAY);
  if (late < 1) return 'current';
  if (late <= 30) return '1-30';
  if (late <= 60) return '31-60';
  if (late <= 90) return '61-90';
  return '90+';
}

export type ReminderStage = 'BEFORE' | 'DUE' | 'OVERDUE' | 'FINAL';
/** Which reminder an unpaid instalment should get today: 3 days before, on the day, 1 day late, 7 days late. */
export function reminderStage(dueDate: Date, now = new Date()): ReminderStage | null {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(dueDate) - startOfDay(now)) / DAY); // >0 = in the future
  if (days <= -7) return 'FINAL';
  if (days <= -1) return 'OVERDUE';
  if (days === 0) return 'DUE';
  if (days <= 3) return 'BEFORE';
  return null;
}

/* ------------------------------ Daraja API ------------------------------ */

const tokens = new Map<string, { token: string; expires: number }>();

async function daraja<T = any>(creds: DarajaCredentials, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${darajaBase(creds.environment)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(creds)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || (json.ResponseCode !== undefined && String(json.ResponseCode) !== '0')) {
    const err: any = new Error(json.errorMessage || json.ResponseDescription || json.CustomerMessage || `M-Pesa request failed (${res.status}).`);
    err.code = json.errorCode;
    throw err;
  }
  return json as T;
}

/** OAuth token, cached in memory until shortly before it expires (Daraja tokens last an hour). */
export async function accessToken(creds: DarajaCredentials): Promise<string> {
  const key = `${creds.environment}:${creds.consumerKey}`;
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now()) return cached.token;
  const res = await fetch(`${darajaBase(creds.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error('Safaricom rejected the consumer key or secret. Check them in your Daraja app.');
  tokens.set(key, { token: json.access_token, expires: Date.now() + (Number(json.expires_in) - 60) * 1000 });
  return json.access_token;
}

export async function stkPush(creds: DarajaCredentials, input: { phone: string; amount: number; accountRef: string; description: string; callbackUrl: string }) {
  const timestamp = darajaTimestamp();
  const till = creds.type === 'TILL';
  const json = await daraja<{ CheckoutRequestID: string; MerchantRequestID: string; CustomerMessage: string }>(creds, '/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: creds.shortcode,
    Password: stkPassword(creds.shortcode, creds.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: till ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: input.amount,
    PartyA: input.phone,
    PartyB: till ? creds.tillNumber || creds.shortcode : creds.shortcode,
    PhoneNumber: input.phone,
    CallBackURL: input.callbackUrl,
    AccountReference: input.accountRef.slice(0, 12),
    TransactionDesc: (input.description || 'Payment').slice(0, 13),
  });
  return { checkoutRequestId: json.CheckoutRequestID, customerMessage: json.CustomerMessage };
}

/** Asks Safaricom for an STK request's outcome. null = the customer has not answered yet. */
export async function stkQuery(creds: DarajaCredentials, checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string } | null> {
  const timestamp = darajaTimestamp();
  try {
    const json: any = await daraja(creds, '/mpesa/stkpushquery/v1/query', {
      BusinessShortCode: creds.shortcode,
      Password: stkPassword(creds.shortcode, creds.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    });
    return { resultCode: Number(json.ResultCode), resultDesc: String(json.ResultDesc || '') };
  } catch (e: any) {
    if (String(e?.code || '').startsWith('500.001.1001')) return null; // still being processed
    throw e;
  }
}

/** Tells Safaricom where to send payments made straight to the Paybill or Till. URLs must be public https. */
export async function registerC2BUrls(creds: DarajaCredentials, confirmationUrl: string, validationUrl: string) {
  return daraja(creds, '/mpesa/c2b/v1/registerurl', {
    ShortCode: creds.type === 'TILL' ? creds.tillNumber || creds.shortcode : creds.shortcode,
    ResponseType: 'Completed',
    ConfirmationURL: confirmationUrl,
    ValidationURL: validationUrl,
  });
}

/** Sandbox only: pretend a customer paid the shortcode directly. */
export async function simulateC2B(creds: DarajaCredentials, amount: number, billRef: string) {
  return daraja(creds, '/mpesa/c2b/v1/simulate', {
    ShortCode: creds.type === 'TILL' ? creds.tillNumber || creds.shortcode : creds.shortcode,
    CommandID: creds.type === 'TILL' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: amount,
    Msisdn: '254708374149', // Safaricom's sandbox test number
    BillRefNumber: billRef,
  });
}
