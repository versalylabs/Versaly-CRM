import prisma from './prisma';

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
