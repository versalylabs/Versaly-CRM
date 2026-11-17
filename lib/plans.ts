/**
 * Single source of truth for subscription plans and their limits.
 * Used by signup, the Stripe webhook, plan changes and billing screens.
 * Keep the landing-page pricing copy in sync with these numbers.
 */
export type PlanKey = 'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE';

export type PlanLimits = {
  name: string;
  leadLimit: number;
  seatLimit: number;
  automationRunLimit: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  STARTER: { name: 'Starter', leadLimit: 1000, seatLimit: 3, automationRunLimit: 100 },
  GROWTH_PRO: { name: 'Growth Pro', leadLimit: 5000, seatLimit: 10, automationRunLimit: 1000 },
  ENTERPRISE: { name: 'Enterprise Scale', leadLimit: 100000, seatLimit: 50, automationRunLimit: 10000 },
};

export function normalizePlan(value: unknown, fallback: PlanKey = 'GROWTH_PRO'): PlanKey {
  return value === 'STARTER' || value === 'GROWTH_PRO' || value === 'ENTERPRISE' ? value : fallback;
}
