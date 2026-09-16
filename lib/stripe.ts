import Stripe from 'stripe';

let stripe: Stripe | null = null;
export function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    stripe = new Stripe(key);
  }
  return stripe;
}

export const PLAN_CONFIG: Record<string, { priceEnv: string; leadLimit: number; seatLimit: number; automationRunLimit: number }> = {
  STARTER: { priceEnv: 'STRIPE_PRICE_STARTER_MONTHLY', leadLimit: 150, seatLimit: 3, automationRunLimit: 100 },
  GROWTH_PRO: { priceEnv: 'STRIPE_PRICE_GROWTH_PRO_MONTHLY', leadLimit: 500, seatLimit: 10, automationRunLimit: 1000 },
  ENTERPRISE: { priceEnv: 'STRIPE_PRICE_ENTERPRISE_MONTHLY', leadLimit: 100000, seatLimit: 50, automationRunLimit: 10000 },
};
