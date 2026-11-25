import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { sendSms, smsNumber, smsSegments } from '@/lib/sms';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX = 500;

/**
 * Bulk SMS to selected leads: { leadIds[], message }. "{{name}}" becomes each lead's first name.
 * shortcut: sends one by one inside the request (fine for a few hundred); move to a queue for larger campaigns.
 */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('sms');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const b = await req.json().catch(() => ({}));
  const message = String(b.message || '').trim();
  const ids = Array.isArray(b.leadIds) ? [...new Set(b.leadIds.map(String))].slice(0, MAX) : [];
  if (!message || message.length > 918) return NextResponse.json({ error: 'Write a message of up to 918 characters (6 SMS).' }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one lead.' }, { status: 400 });

  const leads = await prisma.lead.findMany({ where: { id: { in: ids as string[] }, organizationId: ctx.orgId }, select: { id: true, contactName: true, phone: true } });
  const reachable = leads.filter((l) => smsNumber(l.phone));
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { smsCredits: true } });
  const needed = reachable.reduce((n, l) => n + smsSegments(personalise(message, l.contactName)), 0);
  if ((org?.smsCredits || 0) < needed) {
    return NextResponse.json({ error: `This needs ${needed} SMS credits; you have ${org?.smsCredits || 0}. Buy more in Settings → Messaging.`, needed }, { status: 402 });
  }

  let sent = 0;
  const failed: Array<{ leadId: string; error: string }> = [];
  for (const lead of reachable) {
    const text = personalise(message, lead.contactName);
    const r = await sendSms({ organizationId: ctx.orgId, to: lead.phone!, message: text, userId: ctx.userId });
    if (r.ok) {
      sent++;
      await logLeadActivity(prisma, lead.id, 'SMS', 'SMS sent', { text: text.slice(0, 200), credits: r.credits });
    } else failed.push({ leadId: lead.id, error: r.error || 'Failed' });
  }
  return NextResponse.json({ sent, failed: failed.length, skippedNoPhone: leads.length - reachable.length, errors: failed.slice(0, 10) });
}

const personalise = (message: string, name: string) => message.replace(/\{\{\s*name\s*\}\}/gi, (name || '').split(' ')[0] || 'there');
