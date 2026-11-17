import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '../../../../../lib/tenant';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';

async function getAuthenticatedPrincipal(_req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  return { user: { id: ctx.userId, email: ctx.email || undefined, role: ctx.role }, orgId: ctx.orgId };
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


async function findOwnedEvent(id: string, orgId: string) {
  return prisma.calendarEvent.findFirst({
    where: { id, OR: [{ organizationId: orgId }, { organizationId: null, assignedTo: { organizationId: orgId } }] },
  });
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

  const event = await findOwnedEvent(params.id, principal.orgId);
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
  if (body.description !== undefined) {
    data.description = String(body.description || '').trim() || null;
  }
  if (body.type !== undefined) {
    const type = String(body.type || 'MEETING').toUpperCase();
    data.type = type as any;
  }
  if (body.location !== undefined) {
    data.location = String(body.location || '').trim() || null;
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
  if (body.leadId !== undefined) {
    const leadId = body.leadId ? String(body.leadId).trim() : null;
    if (leadId && !(await prisma.lead.findFirst({ where: { id: leadId, organizationId: principal.orgId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Selected lead was not found.' }, { status: 400 });
    }
    data.leadId = leadId;
  }
  if (body.assignedToId !== undefined) {
    const assigneeId = body.assignedToId ? String(body.assignedToId).trim() : null;
    if (assigneeId && !(await prisma.user.findFirst({ where: { id: assigneeId, isActive: true, organizationId: principal.orgId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Selected assignee was not found.' }, { status: 400 });
    }
    data.assignedToId = assigneeId;
  }

  data.organizationId = principal.orgId;
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

  const event = await findOwnedEvent(params.id, principal.orgId);
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!(await canManageEvent(principal.user, event))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
