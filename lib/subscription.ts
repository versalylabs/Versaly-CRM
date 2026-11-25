import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import prisma from './prisma';
import { FEATURES, PLANS, planHasFeature, type Feature } from './plans';

export type SubscriptionAccess = {
  allowed: boolean;
  readOnly: boolean;
  status: string;
  reason?: string;
  trialDaysRemaining?: number;
};

const ACTIVE = new Set(['active', 'trialing']);

export async function getSubscriptionAccess(organizationId?: string | null): Promise<SubscriptionAccess> {
  if (!organizationId) return { allowed: true, readOnly: false, status: 'active' };
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { planStatus: true, createdAt: true, suspendedAt: true, suspensionReason: true } });
  if (!org) return { allowed: false, readOnly: true, status: 'missing', reason: 'Workspace not found.' };
  if (org.suspendedAt) {
    return { allowed: false, readOnly: true, status: 'suspended', reason: org.suspensionReason || 'This workspace has been temporarily suspended by platform support.' };
  }
  const status = (org.planStatus || 'trialing').toLowerCase();
  if (status === 'trialing') {
    const ends = new Date(org.createdAt.getTime() + 14 * 86400000);
    const remaining = Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000));
    if (remaining <= 0) return { allowed: false, readOnly: true, status: 'expired', reason: 'Your free trial has expired.', trialDaysRemaining: 0 };
    return { allowed: true, readOnly: false, status, trialDaysRemaining: remaining };
  }
  if (ACTIVE.has(status)) return { allowed: true, readOnly: false, status };
  if (status === 'past_due') return { allowed: false, readOnly: true, status, reason: 'Your payment needs attention. The workspace is currently read-only.' };
  if (status === 'canceled' || status === 'cancelled') return { allowed: false, readOnly: true, status: 'canceled', reason: 'This subscription is canceled. The workspace is read-only until reactivated.' };
  return { allowed: false, readOnly: true, status, reason: 'An active subscription is required to make changes.' };
}

export async function assertSubscriptionWriteAccess(organizationId?: string | null) {
  const access = await getSubscriptionAccess(organizationId);
  return access.allowed ? null : access;
}

/**
 * Guard for routes that change workspace data. Returns a 402 response when the
 * signed-in user's workspace is read-only (trial ended, unpaid, canceled or suspended),
 * otherwise null. Unauthenticated requests return null: the route's own auth check handles them.
 * Usage at the top of a write handler: `const readOnly = await blockIfReadOnly(); if (readOnly) return readOnly;`
 */
export async function blockIfReadOnly(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  const orgId = session?.user?.organizationId;
  if (!orgId || session?.user?.isPlatformAdmin) return null;
  const denied = await assertSubscriptionWriteAccess(orgId);
  if (!denied) return null;
  return NextResponse.json(
    { error: denied.reason || 'Your workspace is read-only. Choose a plan to make changes.', readOnly: true, status: denied.status },
    { status: 402 }
  );
}

/**
 * Returns an error message when the workspace is at its plan's lead limit, otherwise null.
 * shortcut: count-then-insert can let two simultaneous creates both pass; acceptable as a soft cap, move to a DB constraint if it matters.
 */
export async function leadLimitError(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { leadLimit: true, _count: { select: { leads: true } } },
  });
  if (!org || org._count.leads < org.leadLimit) return null;
  return `You have reached your plan's limit of ${org.leadLimit.toLocaleString('en-US')} leads. Upgrade your plan to add more.`;
}

/**
 * Plan gate for a feature (see FEATURES in lib/plans). Returns a 403 with an upgrade message
 * when the signed-in workspace's plan does not include it, otherwise null.
 */
export async function blockIfFeatureMissing(feature: Feature): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || session.user.isPlatformAdmin) return null;
  if (planHasFeature(session.user.plan, feature)) return null;
  return upgradeResponse(feature);
}

export function upgradeResponse(feature: Feature) {
  const minPlan = FEATURES[feature].minPlan;
  return NextResponse.json(
    { error: `${FEATURES[feature].label} is included from the ${PLANS[minPlan].name} plan. Upgrade to use it.`, upgradeRequired: true, feature, minPlan },
    { status: 403 }
  );
}
