import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { getStripe, PLAN_CONFIG } from '../../../../../lib/stripe';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only workspace administrators can manage billing.' }, { status: 403 });
  try {
    const { plan, interval = 'month' } = await req.json();
    const config = PLAN_CONFIG[plan];
    if (!config) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
    const priceEnv = interval === 'year' ? config.priceEnv.replace('_MONTHLY', '_ANNUAL') : config.priceEnv;
    const priceId = process.env[priceEnv];
    if (!priceId) return NextResponse.json({ error: `Stripe price is not configured (${priceEnv}).` }, { status: 503 });
    const orgId = session.user.organizationId; if (!orgId) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    const org = await prisma.organization.findUnique({ where: { id: orgId } }); if (!org) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    const stripe = getStripe();
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, email: session.user.email || undefined, metadata: { organizationId: org.id } });
      customerId = customer.id;
      await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } });
    }
    const base = process.env.NEXTAUTH_URL || req.nextUrl.origin;
    const checkout = await stripe.checkout.sessions.create({ mode: 'subscription', customer: customerId, line_items: [{ price: priceId, quantity: 1 }], success_url: `${base}/settings/billing?checkout=success`, cancel_url: `${base}/settings/billing?checkout=cancel`, allow_promotion_codes: true, metadata: { organizationId: org.id, plan, interval } });
    return NextResponse.json({ url: checkout.url });
  } catch (e: any) { console.error(e); return NextResponse.json({ error: e.message || 'Unable to start checkout.' }, { status: 500 }); }
}
