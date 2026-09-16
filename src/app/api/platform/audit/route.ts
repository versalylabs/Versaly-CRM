import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import prisma from '@/lib/prisma';

export async function GET() {
  const { authorized } = await requirePlatformAdmin();
  if (!authorized) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const logs = await prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { organization: { select: { name: true, slug: true } } } });
  return NextResponse.json(logs);
}
