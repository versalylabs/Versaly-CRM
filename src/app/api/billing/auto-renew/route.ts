import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Turn automatic card renewal on or off: { enabled }. Turning it off is how a customer cancels:
 * the plan stays active until the end of the paid period, and the saved card is forgotten.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only workspace admins can manage billing.' }, { status: 403 });
  const { enabled } = await req.json().catch(() => ({}));
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: enabled ? { cancelAtPeriodEnd: false } : { cancelAtPeriodEnd: true, paystackCard: null },
  });
  return NextResponse.json({ success: true, autoRenew: Boolean(enabled) });
}
