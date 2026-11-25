import { blockIfReadOnly } from '../../../../../lib/subscription';
import { advanceStage, getStageGroups } from '@/lib/stages';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';
import { providerRegistry } from '../../../../../lib/communication-providers';

// Sends only through the workspace's own connected mailbox (the provider enforces this),
// never through the platform SMTP account.
const emailProvider = () => providerRegistry.getProvider('EMAIL')!;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = await emailProvider().getConnectionStatus(session.user?.organizationId || '__none__');
  return NextResponse.json({ configured: status.connected, from: status.accountHandle || null });
}

export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const leadId = String(body.leadId || '').trim();
  const subject = String(body.subject || '').trim();
  const content = String(body.content || '').trim();
  const to = String(body.to || '').trim();

  if (!leadId || !subject || !content) {
    return NextResponse.json({ error: 'Lead, subject, and message are required.' }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: session.user?.organizationId || '__none__' } });
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  const recipient = to || lead.email;
  if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
    return NextResponse.json({ error: 'A valid recipient email address is required.' }, { status: 400 });
  }

  const sent = await emailProvider().sendMessage({
    organizationId: lead.organizationId!,
    conversationId: '',
    recipientAddress: recipient,
    subject,
    content,
    senderName: session.user?.name || undefined,
  });
  if (!sent.success) {
    return NextResponse.json({ error: sent.errorMessage || 'The email could not be sent.' }, { status: sent.requiresConnection ? 503 : 502 });
  }

  const stages = await getStageGroups(lead.organizationId);
  const sentAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.outreachLog.create({
      data: { leadId: lead.id, type: 'EMAIL', subject, content, status: 'SENT', sentAt },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lastContact: sentAt,
        outreachStatus: 'SENT',
        pipelineStage: advanceStage(stages, lead.pipelineStage, 'CONTACTED'),
      },
    });
    await logLeadActivity(tx, lead.id, 'email', 'Email sent from CRM', {
      subject,
      recipient,
      outreachLogId: log.id,
      userId: session.user?.id || null,
    });
    return log;
  });

  return NextResponse.json({ success: true, outreachLog: result }, { status: 201 });
}
