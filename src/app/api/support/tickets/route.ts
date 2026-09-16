import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, cleanText, isOneOf, notifySupportEmail, logSupport } from '@/lib/support';

async function sessionOrNull() { return getServerSession(authOptions); }

export async function GET() {
  const session = await sessionOrNull();
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: 'Sign in to view support tickets.' }, { status: 401 });
  const canViewAll = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';
  const tickets = await prisma.supportTicket.findMany({
    where: { organizationId: session.user.organizationId, ...(canViewAll ? {} : { requesterId: session.user.id }) },
    select: { id: true, subject: true, description: true, status: true, priority: true, category: true, createdAt: true, updatedAt: true, lastResponseAt: true, requester: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  const session = await sessionOrNull();
  if (!session?.user?.id || !session.user.organizationId) return NextResponse.json({ error: 'Sign in to contact support.' }, { status: 401 });

  try {
    const body = await request.json();
    const subject = cleanText(body.subject, 160);
    const description = cleanText(body.description, 8000);
    const priority = String(body.priority || 'NORMAL').toUpperCase();
    const category = String(body.category || 'GENERAL').toUpperCase();
    if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    if (description.length < 10) return NextResponse.json({ error: 'Please provide at least 10 characters describing the issue.' }, { status: 400 });
    if (!isOneOf(TICKET_PRIORITIES, priority)) return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
    if (!isOneOf(TICKET_CATEGORIES, category)) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true } });
    const org = await prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { id: true, name: true } });
    if (!user || !org) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: org.id,
        requesterId: user.id,
        subject,
        description,
        priority,
        category,
        messages: { create: { authorUserId: user.id, authorEmail: user.email, body: description, isInternal: false } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } }, requester: { select: { id: true, name: true, email: true } } },
    });
    logSupport('ticket_created', { ticketId: ticket.id, organizationId: org.id, requesterId: user.id });
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(x => x.trim()).filter(Boolean);
    for (const email of adminEmails) await notifySupportEmail({ to: email, subject: `[Straten Support] ${org.name}: ${subject}`, body: `${org.name} opened a support ticket.\n\nPriority: ${priority}\nCategory: ${category}\nRequester: ${user.name || user.email}\n\n${description}` });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Failed to create support ticket', error);
    return NextResponse.json({ error: 'Could not create support ticket.' }, { status: 500 });
  }
}
