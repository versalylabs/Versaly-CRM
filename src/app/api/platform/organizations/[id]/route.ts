import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import prisma from '@/lib/prisma';
import { cleanText } from '@/lib/support';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { authorized, session } = await requirePlatformAdmin();
  if (!authorized || !session?.user?.email) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const org = await prisma.organization.findUnique({ where: { id: params.id }, select: { id: true, name: true, suspendedAt: true, suspensionReason: true } });
  if (!org) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const body = await request.json();
  const suspend = Boolean(body.suspended);
  const reason = cleanText(body.reason, 500);
  if (suspend && !reason) return NextResponse.json({ error: 'A suspension reason is required.' }, { status: 400 });
  const updated = await prisma.organization.update({ where: { id: org.id }, data: { suspendedAt: suspend ? new Date() : null, suspensionReason: suspend ? reason : null }, select: { id: true, name: true, suspendedAt: true, suspensionReason: true, planStatus: true } });
  await prisma.platformAuditLog.create({ data: { organizationId: org.id, actorUserId: session.user.id || null, actorEmail: session.user.email, action: suspend ? 'account.suspended' : 'account.reactivated', metadata: { reason: suspend ? reason : null } } });
  return NextResponse.json(updated);
}
