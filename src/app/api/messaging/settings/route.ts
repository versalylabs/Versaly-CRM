import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { planHasFeature } from '@/lib/plans';
import { SMS_PACKS, smsConfigured } from '@/lib/sms';
import { WHATSAPP_RATE_KES, estimateCost } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/** Team inbox rules, WhatsApp connection + this month's usage, and the SMS credit balance. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [org, wa, sent, ledger] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { autoAssignInbox: true, inboxSlaMinutes: true, smsCredits: true, smsSenderId: true, plan: true } }),
    prisma.connectedChannelAccount.findFirst({ where: { organizationId: ctx.orgId, channel: 'WHATSAPP' }, orderBy: { updatedAt: 'desc' } }),
    prisma.conversationMessage.findMany({
      where: { channel: 'WHATSAPP', direction: 'OUTBOUND', sentAt: { gte: monthStart }, conversation: { organizationId: ctx.orgId } },
      select: { metadata: true },
      take: 20000,
    }),
    prisma.smsCreditLedger.findMany({ where: { organizationId: ctx.orgId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  // Category comes from Meta's delivery status; until it arrives a message counts as a free service reply.
  const counts: Record<string, number> = { service: 0, utility: 0, marketing: 0, authentication: 0 };
  for (const m of sent) {
    const cat = String((m.metadata as any)?.category || 'service');
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return NextResponse.json({
    inbox: { autoAssign: org?.autoAssignInbox || false, slaMinutes: org?.inboxSlaMinutes || null },
    whatsapp: wa
      ? { connected: wa.status === 'CONNECTED', number: wa.accountHandle, name: wa.accountName, wabaId: (wa.metadata as any)?.wabaId || null, embedded: Boolean((wa.metadata as any)?.embeddedSignup) }
      : null,
    usage: { month: monthStart.toISOString(), counts, estimateKes: estimateCost(counts), rates: WHATSAPP_RATE_KES },
    sms: {
      available: smsConfigured(),
      allowed: planHasFeature(org?.plan, 'sms'),
      credits: org?.smsCredits || 0,
      senderId: org?.smsSenderId || null,
      canSetSenderId: planHasFeature(org?.plan, 'sms_sender_id'),
      packs: SMS_PACKS,
      ledger,
    },
  });
}

/** { autoAssign?, slaMinutes?, wabaId?, senderId? } — admins and managers only. */
export async function PATCH(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can change messaging settings.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const data: any = {};
  if (b.autoAssign !== undefined) data.autoAssignInbox = Boolean(b.autoAssign);
  if (b.slaMinutes !== undefined) {
    const m = b.slaMinutes === null || b.slaMinutes === '' ? null : Math.round(Number(b.slaMinutes));
    if (m !== null && (!Number.isFinite(m) || m < 5 || m > 1440)) return NextResponse.json({ error: 'Reply-time target must be between 5 minutes and 24 hours.' }, { status: 400 });
    data.inboxSlaMinutes = m;
  }
  if (b.senderId !== undefined) {
    const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true } });
    if (!planHasFeature(org?.plan, 'sms_sender_id')) return NextResponse.json({ error: 'Your own SMS sender name is included in Enterprise.', upgradeRequired: true }, { status: 403 });
    const s = String(b.senderId || '').trim();
    if (s && !/^[A-Za-z0-9 ]{3,11}$/.test(s)) return NextResponse.json({ error: 'Sender names are 3 to 11 letters or numbers, and must first be approved by Africa\'s Talking.' }, { status: 400 });
    data.smsSenderId = s || null;
  }
  if (Object.keys(data).length) await prisma.organization.update({ where: { id: ctx.orgId }, data });

  if (b.wabaId !== undefined) {
    const wa = await prisma.connectedChannelAccount.findFirst({ where: { organizationId: ctx.orgId, channel: 'WHATSAPP' } });
    if (!wa) return NextResponse.json({ error: 'Connect WhatsApp first.' }, { status: 400 });
    const wabaId = String(b.wabaId || '').replace(/\D/g, '');
    await prisma.connectedChannelAccount.update({ where: { id: wa.id }, data: { metadata: { ...((wa.metadata || {}) as any), wabaId: wabaId || null } } });
  }
  return NextResponse.json({ success: true });
}
