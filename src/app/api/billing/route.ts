import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { PLANS, PLAN_ORDER, SHARED_FEATURES, normalizePlan } from '../../../../lib/plans';
import { paystackConfigured, readSavedCard } from '../../../../lib/billing';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No workspace found for this user' }, { status: 404 });
    }

    const [org, totalLeads, totalSeats, invoiceRows] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
      }),
      prisma.lead.count({
        where: { organizationId },
      }),
      prisma.user.count({
        where: { organizationId },
      }),
      prisma.invoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 24 }),
    ]);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Calculate trial countdown (14 days from creation)
    const createdAt = new Date(org.createdAt).getTime();
    const now = Date.now();
    const trialDurationMs = 14 * 24 * 60 * 60 * 1000;
    const trialEndMs = createdAt + trialDurationMs;
    const daysRemaining = Math.max(0, Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000)));

    const plans = PLAN_ORDER.map((key) => {
      const p = PLANS[key];
      return {
        id: p.key,
        name: p.name,
        badge: p.popular ? 'Most Popular' : undefined,
        priceMonthly: p.priceKes.monthly,
        priceAnnual: p.priceKes.annual,
        currency: 'KES',
        description: p.description,
        leadLimit: p.leadLimit,
        seatLimit: p.seatLimit,
        features: p.features,
        comingSoon: p.comingSoon,
      };
    });
    const currentPlan = plans.find((p) => p.id === normalizePlan(org.plan)) || plans[1];
    const invoices = invoiceRows.map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: (inv.paidAt || inv.createdAt).toISOString(),
      amount: inv.amountKes,
      currency: 'KES',
      status: inv.status,
      plan: PLANS[normalizePlan(inv.plan)].name,
      interval: inv.interval,
    }));
    const card = readSavedCard(org.paystackCard);

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        planStatus: org.planStatus,
        currency: org.currency,
        createdAt: org.createdAt,
        trialDaysRemaining: daysRemaining,
        isTrialing: org.planStatus === 'trialing',
        leadLimit: org.leadLimit,
        leadUsed: totalLeads,
        leadPercentage: Math.min(100, Math.round((totalLeads / org.leadLimit) * 100)),
        seatLimit: org.seatLimit,
        seatUsed: Math.max(1, totalSeats),
        seatPercentage: Math.min(100, Math.round((Math.max(1, totalSeats) / org.seatLimit) * 100)),
        billingInterval: org.billingInterval,
        currentPeriodEnd: org.currentPeriodEnd,
        autoRenew: Boolean(card) && !org.cancelAtPeriodEnd,
        card: card ? { brand: card.brand || 'Card', last4: card.last4 || '', exp: card.exp || '' } : null,
      },
      paymentsEnabled: paystackConfigured(),
      plans,
      sharedFeatures: SHARED_FEATURES,
      currentPlan,
      invoices,
    });
  } catch (error) {
    console.error('Failed to fetch billing data:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
