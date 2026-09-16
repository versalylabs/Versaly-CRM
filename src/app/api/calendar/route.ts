import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';
import prisma from '../../../../lib/prisma';

const TYPES = ['MEETING', 'CALL', 'FOLLOW_UP', 'PROPERTY_VIEWING', 'OTHER'];

function isManager(role?: string) {
  return role === 'ADMIN' || role === 'MANAGER';
}

function parseDate(value: unknown, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label.toLowerCase()}.`);
  return date;
}

async function getAuthenticatedPrincipal(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) return { user: session.user };

  // Fallback for development JWT sessions when getServerSession is not hydrated
  // in a route request. The token is still verified with NEXTAUTH_SECRET.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;
  return {
    user: {
      id: typeof token.id === 'string' ? token.id : undefined,
      email: typeof token.email === 'string' ? token.email : undefined,
      name: typeof token.name === 'string' ? token.name : null,
      role: typeof token.role === 'string' ? token.role : undefined,
    },
  };
}

async function resolveUser(user: any) {
  const id = user?.id;
  if (id) {
    // The JWT/session ID is sufficient to scope reads even if a stale database
    // lookup temporarily fails; writes below still verify the assignee.
    const found = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (found?.isActive) return found.id;
  }

  const email = String(user?.email || '').trim().toLowerCase();
  if (email) {
    const direct = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
    if (direct?.isActive) return direct.id;

    const candidates = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true }
    });
    const match = candidates.find((candidate: any) => String(candidate.email || '').trim().toLowerCase() === email);
    if (match) return match.id;
  }
  return null;
}


export async function GET(req: NextRequest) {
  const principal = await getAuthenticatedPrincipal(req);
  if (!principal?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentUserId = await resolveUser(principal.user);
  if (!currentUserId) {
    return NextResponse.json({ error: 'Active user account not found. Please sign out and sign in again.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const start = startParam ? new Date(startParam) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endParam ? new Date(endParam) : new Date(new Date().setDate(new Date().getDate() + 90));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
  }

  const where: any = { startAt: { gte: start, lte: end } };
  if (!isManager(principal.user.role)) where.assignedToId = currentUserId;

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      lead: { select: { id: true, contactName: true, companyName: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const principal = await getAuthenticatedPrincipal(req);
  if (!principal?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const currentUserId = await resolveUser(principal.user);
    if (!currentUserId) return NextResponse.json({ error: 'Active user account not found.' }, { status: 401 });

    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Event title is required.' }, { status: 400 });

    const type = String(body.type || 'MEETING').toUpperCase();
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid event type.' }, { status: 400 });

    const startAt = parseDate(body.startAt, 'Start date');
    const endAt = body.endAt ? parseDate(body.endAt, 'End date') : null;
    if (endAt && endAt.getTime() < startAt.getTime()) {
      return NextResponse.json({ error: 'End time must be after the start time.' }, { status: 400 });
    }

    const requestedAssignee = String(body.assignedToId || '').trim();
    const assignedToId = isManager(principal.user.role)
      ? (requestedAssignee || currentUserId)
      : currentUserId;

    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, isActive: true },
      select: { id: true }
    });
    if (!assignee) return NextResponse.json({ error: 'Selected assignee was not found or is inactive.' }, { status: 400 });

    const leadId = String(body.leadId || '').trim() || null;
    if (leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: 'Selected lead was not found.' }, { status: 400 });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description: String(body.description || '').trim() || null,
        type: type as any,
        startAt,
        endAt,
        location: String(body.location || '').trim() || null,
        reminderAt: body.reminderAt ? parseDate(body.reminderAt, 'Reminder date') : null,
        leadId,
        assignedToId: assignee.id,
      },
      include: {
        lead: { select: { id: true, contactName: true, companyName: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create calendar event.' }, { status: 500 });
  }
}
