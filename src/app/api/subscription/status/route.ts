import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { getSubscriptionAccess } from '../../../../../lib/subscription';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await getSubscriptionAccess(session.user?.organizationId);
  return NextResponse.json(access);
}
