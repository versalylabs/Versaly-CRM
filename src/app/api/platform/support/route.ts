import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { authorized } = await requirePlatformAdmin();
  if (!authorized) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (q) where.OR = [{ subject: { contains: q } }, { organization: { name: { contains: q } } }, { requester: { email: { contains: q } } }];
  const tickets = await prisma.supportTicket.findMany({ where, include: { organization: { select: { id: true, name: true, slug: true, plan: true, planStatus: true, suspendedAt: true, suspensionReason: true } }, requester: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { authorUser: { select: { name: true, email: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  const counts = await prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } });
  return NextResponse.json({ tickets, counts: Object.fromEntries(counts.map(x => [x.status, x._count._all])) });
}
