import { blockIfReadOnly } from '../../../../../lib/subscription';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';
import { providerRegistry } from '../../../../../lib/communication-providers';

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const leadId = String(body.leadId || '').trim();
  const message = String(body.message || '').trim();
  const requestedPhone = normalizePhone(String(body.phone || ''));
  if (!leadId || !message) return NextResponse.json({ error: 'Lead and message are required.' }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: session.user?.organizationId || '__none__' } });
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  const recipient = requestedPhone || normalizePhone(String(lead.phone || ''));
  if (recipient.length < 8) return NextResponse.json({ error: 'A valid lead phone number is required. Use international format, for example 2547XXXXXXXX.' }, { status: 400 });

  // Sends only through the workspace's own connected WhatsApp number (the provider enforces this).
  const sent = await providerRegistry.getProvider('WHATSAPP')!.sendMessage({
    organizationId: lead.organizationId!,
    conversationId: '',
    recipientAddress: recipient,
    content: message,
  });
  if (!sent.success) {
    return NextResponse.json({ error: sent.errorMessage || 'WhatsApp rejected the message.' }, { status: sent.requiresConnection ? 503 : 502 });
  }

  const sentAt = new Date();
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.outreachLog.create({ data: { leadId: lead.id, type: 'WHATSAPP', content: message, status: 'SENT', sentAt } });
    await tx.lead.update({ where: { id: lead.id }, data: { lastContact: sentAt, outreachStatus: 'SENT', pipelineStage: ['NEW_LEAD','RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined } });
    await logLeadActivity(tx, lead.id, 'whatsapp', 'WhatsApp message sent from CRM', { recipient, outreachLogId: created.id, providerMessageId: sent.externalMessageId || null, userId: session.user.id || null });
    return created;
  });
  return NextResponse.json({ success: true, outreachLog: log }, { status: 201 });
}
