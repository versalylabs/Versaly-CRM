import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';

function configured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!configured()) return NextResponse.json({ error: 'WhatsApp Cloud API is not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.' }, { status: 503 });

  const body = await req.json();
  const leadId = String(body.leadId || '').trim();
  const message = String(body.message || '').trim();
  const requestedPhone = normalizePhone(String(body.phone || ''));
  if (!leadId || !message) return NextResponse.json({ error: 'Lead and message are required.' }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  const recipient = requestedPhone || normalizePhone(String(lead.phone || ''));
  if (recipient.length < 8) return NextResponse.json({ error: 'A valid lead phone number is required. Use international format, for example 2547XXXXXXXX.' }, { status: 400 });

  const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let response: Response;
  let payload: any;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'text', text: { preview_url: true, body: message } }),
    });
    payload = await response.json();
  } catch (error) {
    console.error('WhatsApp send failed', error);
    return NextResponse.json({ error: 'Could not reach the WhatsApp Cloud API.' }, { status: 502 });
  }
  if (!response.ok) {
    console.error('WhatsApp Cloud API error', payload);
    return NextResponse.json({ error: payload?.error?.message || 'WhatsApp rejected the message.' }, { status: 502 });
  }

  const sentAt = new Date();
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.outreachLog.create({ data: { leadId: lead.id, type: 'WHATSAPP', content: message, status: 'SENT', sentAt } });
    await tx.lead.update({ where: { id: lead.id }, data: { lastContact: sentAt, outreachStatus: 'SENT', pipelineStage: ['NEW_LEAD','RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined } });
    await logLeadActivity(tx, lead.id, 'whatsapp', 'WhatsApp message sent from CRM', { recipient, outreachLogId: created.id, providerMessageId: payload?.messages?.[0]?.id || null, userId: session.user.id || null });
    return created;
  });
  return NextResponse.json({ success: true, outreachLog: log, provider: payload }, { status: 201 });
}
