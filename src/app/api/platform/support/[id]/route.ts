import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import prisma from '@/lib/prisma';
import { TICKET_STATUSES, TICKET_PRIORITIES, cleanText, isOneOf, notifySupportEmail, logSupport } from '@/lib/support';

async function audit(actorEmail: string, actorUserId: string | undefined, organizationId: string, action: string, metadata: any = {}) {
  await prisma.platformAuditLog.create({ data: { organizationId, actorEmail, actorUserId: actorUserId || null, action, metadata: metadata as any } });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { authorized, session } = await requirePlatformAdmin();
  if (!authorized || !session?.user?.email) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id }, include: { organization: { select: { id: true, name: true } }, requester: { select: { email: true } } } });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  try {
    const body = await request.json();
    const message = cleanText(body.message, 8000);
    const isInternal = Boolean(body.isInternal);
    if (message.length < 2) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    const created = await prisma.supportMessage.create({ data: { ticketId: ticket.id, authorUserId: session.user.id || null, authorEmail: session.user.email, body: message, isInternal } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { lastResponseAt: new Date(), status: isInternal ? ticket.status : 'WAITING_ON_CUSTOMER' } });
    await audit(session.user.email, session.user.id, ticket.organizationId, isInternal ? 'support.internal_note_added' : 'support.agent_reply_sent', { ticketId: ticket.id });
    logSupport('agent_reply', { ticketId: ticket.id, organizationId: ticket.organizationId, isInternal });
    if (!isInternal) await notifySupportEmail({ to: ticket.requester.email, subject: `[Straten Support] Re: ${ticket.subject}`, body: `Support replied to your ticket for ${ticket.organization.name}.\n\n${message}` });
    return NextResponse.json(created, { status: 201 });
  } catch (error) { console.error('Platform support reply failed', error); return NextResponse.json({ error: 'Could not send support reply.' }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { authorized, session } = await requirePlatformAdmin();
  if (!authorized || !session?.user?.email) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  const body = await request.json();
  const data: any = {};
  if (body.status !== undefined) { const status = String(body.status).toUpperCase(); if (!isOneOf(TICKET_STATUSES, status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 }); data.status = status; }
  if (body.priority !== undefined) { const priority = String(body.priority).toUpperCase(); if (!isOneOf(TICKET_PRIORITIES, priority)) return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 }); data.priority = priority; }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data });
  await audit(session.user.email, session.user.id, ticket.organizationId, 'support.ticket_updated', { ticketId: ticket.id, changes: data });
  return NextResponse.json(updated);
}
