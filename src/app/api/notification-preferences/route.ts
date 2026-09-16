import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const preference = await prisma.notificationPreference.upsert({ where: { userId: session.user.id }, update: {}, create: { userId: session.user.id } });
  return NextResponse.json(preference);
}
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const allowed = ['taskNotifications','leadNotifications','followUpNotifications','proposalNotifications','calendarNotifications','emailNotifications'];
  const update: Record<string, boolean> = {};
  for (const key of allowed) if (typeof data[key] === 'boolean') update[key] = data[key];
  const preference = await prisma.notificationPreference.upsert({ where: { userId: session.user.id }, update, create: { userId: session.user.id, ...update } });
  return NextResponse.json(preference);
}
