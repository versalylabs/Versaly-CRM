/**
 * Single source of truth for subscription plans: limits, prices and the feature copy
 * shown on the landing page and the billing page. List only features that exist in the
 * product today; anything not built yet goes in `comingSoon`.
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

/** Must match the API key limits enforced in src/app/api/developer/keys/route.ts. */
export const API_KEY_LIMITS: Record<PlanKey, number> = { STARTER: 2, GROWTH_PRO: 10, ENTERPRISE: 50 };

export type PlanDetails = PlanLimits & {
  key: PlanKey;
  /** KES per month: `monthly` when billed monthly, `annual` when billed yearly. */
  priceKes: { monthly: number; annual: number };
  description: string;
  popular?: boolean;
  /** Plan-specific lines: limits and support level. */
  features: string[];
  comingSoon: string[];
};

const n = (value: number) => value.toLocaleString('en-US');
const limitLines = (key: PlanKey) => {
  const p = PLAN_LIMITS[key];
  return [
    `${n(p.leadLimit)} active leads`,
    `Up to ${p.seatLimit} team members`,
    `${n(p.automationRunLimit)} automation runs / month`,
    `${API_KEY_LIMITS[key]} developer API keys`,
  ];
};

export const PLANS: Record<PlanKey, PlanDetails> = {
  STARTER: {
    key: 'STARTER',
    ...PLAN_LIMITS.STARTER,
    priceKes: { monthly: 3900, annual: 3200 },
    description: 'For small teams moving their leads out of WhatsApp chats and spreadsheets.',
    features: [...limitLines('STARTER'), 'Email support'],
    comingSoon: ['M-Pesa payment requests', 'CSV & Excel contact import'],
  },
  GROWTH_PRO: {
    key: 'GROWTH_PRO',
    ...PLAN_LIMITS.GROWTH_PRO,
    priceKes: { monthly: 9900, annual: 8200 },
    description: 'For growing sales teams that need more capacity, more automation and faster support.',
    popular: true,
    features: [...limitLines('GROWTH_PRO'), 'Priority email & WhatsApp support'],
    comingSoon: ['M-Pesa auto-reconciliation', 'KRA eTIMS invoicing', 'AI reply assistant'],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    ...PLAN_LIMITS.ENTERPRISE,
    priceKes: { monthly: 24900, annual: 19900 },
    description: 'For large or multi-branch teams that need high volume and hands-on onboarding.',
    features: [...limitLines('ENTERPRISE'), 'Guided onboarding & priority support'],
    comingSoon: ['Audit log export', 'Custom fields', 'Multiple branches & WhatsApp numbers'],
  },
};

export const PLAN_ORDER: PlanKey[] = ['STARTER', 'GROWTH_PRO', 'ENTERPRISE'];

/** Included in every plan. Keep to features that work today. */
export const SHARED_FEATURES = [
  'Visual deal pipeline with custom stages',
  'Leads, tasks & calendar',
  'Team inbox for your own email address',
  'WhatsApp Cloud API messaging',
  'Proposals with status tracking',
  'Workflow automations',
  'Reports with CSV export',
  'Customer success & renewal tracking',
  'Developer API & webhooks',
];

/** Yearly saving in KES when paying annually instead of monthly. */
export const annualSavingsKes = (plan: PlanDetails) => (plan.priceKes.monthly - plan.priceKes.annual) * 12;

export function normalizePlan(value: unknown, fallback: PlanKey = 'GROWTH_PRO'): PlanKey {
  return value === 'STARTER' || value === 'GROWTH_PRO' || value === 'ENTERPRISE' ? value : fallback;
}
