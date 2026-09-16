import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';

async function getAuthenticatedPrincipal(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) return { user: session.user };
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;
  return { user: { id: typeof token.id === 'string' ? token.id : undefined, email: typeof token.email === 'string' ? token.email : undefined, role: typeof token.role === 'string' ? token.role : undefined } };
}

async function resolveUser(user: any) {
  if (user?.id) {
    const found = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, isActive: true } });
    if (found?.isActive) return found.id;
  }
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return null;
  const direct = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  if (direct?.isActive) return direct.id;
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true } });
  return users.find((u: any) => String(u.email || '').trim().toLowerCase() === email)?.id || null;
}


function isManager(role?: string) {
  return role === 'ADMIN' || role === 'MANAGER';
}

async function canManageEvent(user: any, event: any) {
  const userId = await resolveUser(user);
  return !!userId && (isManager(user.role) || event.assignedToId === userId);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getAuthenticatedPrincipal(req);
  if (!principal?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!(await canManageEvent(principal.user, event))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data: any = {};

  if (typeof body.completed === 'boolean') data.completed = body.completed;
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: 'Event title is required.' }, { status: 400 });
    data.title = title;
  }
  if (body.startAt !== undefined) {
    const d = new Date(String(body.startAt));
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 });
    data.startAt = d;
  }
  if (body.endAt !== undefined) {
    data.endAt = body.endAt ? new Date(String(body.endAt)) : null;
    if (data.endAt && Number.isNaN(data.endAt.getTime())) return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 });
  }
  if (data.startAt && data.endAt && data.endAt < data.startAt) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 });
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data,
    include: {
      lead: { select: { id: true, contactName: true, companyName: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    }
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getAuthenticatedPrincipal(req);
  if (!principal?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!(await canManageEvent(principal.user, event))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
