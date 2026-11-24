import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { PLANS, PLAN_ORDER, SHARED_FEATURES, normalizePlan } from '../../../../lib/plans';

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

    const [org, totalLeads, totalSeats] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
      }),
      prisma.lead.count({
        where: { organizationId },
      }),
      prisma.user.count({
        where: { organizationId },
      }),
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

    // Prices are set in KES (lib/plans.ts). Invoices will come from the payment
    // provider in Phase 4; until then none are shown rather than placeholder ones.
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
    const invoices: Array<{ id: string; date: string; amount: number; currency: string; status: string; plan: string }> = [];

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
      },
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
