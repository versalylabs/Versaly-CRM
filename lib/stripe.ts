import Stripe from 'stripe';
import { PLAN_LIMITS } from './plans';

let stripe: Stripe | null = null;
export function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    stripe = new Stripe(key);
  }
  return stripe;
}

// Limits come from lib/plans.ts so signup, billing and the Stripe webhook always agree.
export const PLAN_CONFIG: Record<string, { priceEnv: string; leadLimit: number; seatLimit: number; automationRunLimit: number }> = {
  STARTER: { priceEnv: 'STRIPE_PRICE_STARTER_MONTHLY', ...PLAN_LIMITS.STARTER },
  GROWTH_PRO: { priceEnv: 'STRIPE_PRICE_GROWTH_PRO_MONTHLY', ...PLAN_LIMITS.GROWTH_PRO },
  ENTERPRISE: { priceEnv: 'STRIPE_PRICE_ENTERPRISE_MONTHLY', ...PLAN_LIMITS.ENTERPRISE },
};
