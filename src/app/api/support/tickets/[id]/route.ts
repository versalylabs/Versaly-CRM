import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { TICKET_STATUSES, cleanText, isOneOf, notifySupportEmail, logSupport } from '@/lib/support';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, organizationId: session.user.organizationId }, include: { requester: { select: { id: true, name: true, email: true } }, messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' }, include: { authorUser: { select: { name: true, email: true } } } } } });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  if (ticket.requesterId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') return NextResponse.json({ error: 'You do not have access to this ticket.' }, { status: 403 });
  return NextResponse.json(ticket);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, organizationId: session.user.organizationId }, include: { organization: { select: { name: true } } } });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  if (ticket.requesterId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') return NextResponse.json({ error: 'You do not have access to this ticket.' }, { status: 403 });
  if (ticket.status === 'CLOSED') return NextResponse.json({ error: 'Closed tickets cannot receive replies. Open a new ticket if you still need help.' }, { status: 409 });
  try {
    const body = await request.json();
    const message = cleanText(body.message, 8000);
    if (message.length < 2) return NextResponse.json({ error: 'Reply cannot be empty.' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const created = await prisma.supportMessage.create({ data: { ticketId: ticket.id, authorUserId: session.user.id, authorEmail: user.email, body: message, isInternal: false } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'OPEN', lastResponseAt: new Date() } });
    logSupport('customer_reply', { ticketId: ticket.id, organizationId: session.user.organizationId, userId: session.user.id });
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(x => x.trim()).filter(Boolean);
    for (const email of adminEmails) await notifySupportEmail({ to: email, subject: `[Straten Support] Reply: ${ticket.subject}`, body: `${ticket.organization.name} replied to ticket ${ticket.subject}.\n\n${message}` });
    return NextResponse.json(created, { status: 201 });
  } catch (error) { console.error('Failed to reply to support ticket', error); return NextResponse.json({ error: 'Could not send reply.' }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, organizationId: session.user.organizationId } });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  if (ticket.requesterId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') return NextResponse.json({ error: 'You do not have access to this ticket.' }, { status: 403 });
  const body = await request.json();
  const status = String(body.status || '').toUpperCase();
  if (!isOneOf(TICKET_STATUSES, status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status } });
  logSupport('customer_status_changed', { ticketId: ticket.id, status, userId: session.user.id });
  return NextResponse.json(updated);
}
