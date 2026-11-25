import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PLAN_ORDER, type PlanKey } from '@/lib/plans';
import { normalizeInterval, paystackConfigured, startCheckout } from '@/lib/billing';
import { appUrl } from '@/lib/accountTokens';

/** Start paying for a plan: { plan, interval: 'month' | 'year' } -> { url } of the Paystack payment page. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only workspace admins can manage billing.' }, { status: 403 });
  if (!paystackConfigured()) return NextResponse.json({ error: 'Online payments are not switched on yet. Please contact us to subscribe.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (!PLAN_ORDER.includes(body.plan)) return NextResponse.json({ error: 'Choose a valid plan.' }, { status: 400 });
  try {
    const url = await startCheckout({
      organizationId: session.user.organizationId,
      email: session.user.email,
      plan: body.plan as PlanKey,
      interval: normalizeInterval(body.interval),
      callbackUrl: `${appUrl(req.nextUrl.origin)}/api/billing/verify`,
    });
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Paystack checkout failed', error);
    return NextResponse.json({ error: 'We could not start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
