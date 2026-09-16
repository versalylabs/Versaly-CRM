import prisma from './prisma';
import { sendEmail } from './email';
import { logEvent, logError } from './observability';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const TICKET_CATEGORIES = ['GENERAL', 'BILLING', 'BUG', 'ACCOUNT', 'FEATURE', 'SECURITY'] as const;

export function cleanText(value: unknown, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

export function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

export async function notifySupportEmail(input: { to: string; subject: string; body: string }) {
  try {
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return result;
  } catch (error) {
    logError('support_email_failed', error, { to: input.to, subject: input.subject });
    return { sent: false as const, skipped: false as const, reason: 'Email delivery failed' };
  }
}

export function logSupport(event: string, details: Record<string, unknown> = {}) {
  logEvent(`support.${event}`, details);
}
