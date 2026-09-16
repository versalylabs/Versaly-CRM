import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

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

    const plans = [
      {
        id: 'STARTER',
        name: 'Starter Tier',
        priceMonthly: 29,
        currency: org.currency || 'USD',
        description: 'Essential CRM tools for boutique agents and solo dealmakers.',
        leadLimit: 150,
        seatLimit: 3,
        features: [
          'Up to 150 Active Prospects',
          '3 Team Member Seats',
          'Pipeline Kanban & Status Flow',
          'Standard Email Templates',
          'Standard Analytics',
        ],
      },
      {
        id: 'GROWTH_PRO',
        name: 'Growth Pro',
        badge: 'Most Popular',
        priceMonthly: 79,
        currency: org.currency || 'USD',
        description: 'Advanced pipeline intelligence & multi-channel outreach for high-growth teams.',
        leadLimit: 500,
        seatLimit: 10,
        features: [
          'Up to 500 Active Prospects',
          '10 Team Member Seats',
          'Interactive Trajectory Area Charts',
          'Conversion Radial Gauges & Velocity Bars',
          'WhatsApp & Automated Email Workflows',
          'Priority Email & Chat Support',
        ],
      },
      {
        id: 'ENTERPRISE',
        name: 'Enterprise Scale',
        badge: 'Maximum Power',
        priceMonthly: 199,
        currency: org.currency || 'USD',
        description: 'High-volume prospecting, custom webhooks, and team governance.',
        leadLimit: 100000,
        seatLimit: 50,
        features: [
          'Unlimited Active Prospects',
          'Up to 50 Team Member Seats',
          'Full Webhook & Meta Lead Ads Integration',
          'White-Label Workspace & Custom Domain',
          'Dedicated Account Manager & 99.9% SLA',
        ],
      },
    ];

    const currentPlan = plans.find((p) => p.id === org.plan) || plans[1];

    const invoices = [
      {
        id: 'INV-2026-009',
        date: new Date(now - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: org.plan === 'STARTER' ? 29 : org.plan === 'ENTERPRISE' ? 199 : 79,
        currency: org.currency || 'USD',
        status: 'Paid',
        plan: currentPlan.name,
      },
    ];

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
      currentPlan,
      invoices,
    });
  } catch (error) {
    console.error('Failed to fetch billing data:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
