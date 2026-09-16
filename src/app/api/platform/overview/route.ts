import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/platformAdmin';

const MONTHLY: Record<string, number> = { STARTER: 29, GROWTH_PRO: 79, ENTERPRISE: 199 };

export async function GET() {
  const { authorized } = await requirePlatformAdmin();
  if (!authorized) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, plan: true, planStatus: true, leadLimit: true, seatLimit: true, createdAt: true, users: { select: { id: true } }, leads: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const statusCounts = organizations.reduce<Record<string, number>>((acc, org) => {
    acc[org.planStatus] = (acc[org.planStatus] || 0) + 1;
    return acc;
  }, {});
  const activeStatuses = new Set(['active']);
  const paidOrActive = organizations.filter((org) => activeStatuses.has(org.planStatus));
  const mrr = paidOrActive.reduce((sum, org) => sum + (MONTHLY[org.plan] || 0), 0);
  const total = organizations.length;
  const trials = statusCounts.trialing || 0;
  const canceled = statusCounts.canceled || 0;

  return NextResponse.json({
    metrics: {
      totalOrganizations: total,
      activeSubscriptions: statusCounts.active || 0,
      trialing: trials,
      pastDue: statusCounts.past_due || 0,
      canceled,
      mrr,
      arr: mrr * 12,
      trialRate: total ? Number(((trials / total) * 100).toFixed(1)) : 0,
      cancellationRate: total ? Number(((canceled / total) * 100).toFixed(1)) : 0,
    },
    organizations: organizations.map((org) => ({
      ...org,
      userCount: org.users.length,
      leadCount: org.leads.length,
      users: undefined,
      leads: undefined,
    })),
  });
}
