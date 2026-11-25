/**
 * Single source of truth for subscription plans: prices, limits and which features each plan
 * unlocks. The landing page, signup, billing page and server-side checks all read from here.
 * Only list features that exist today in FEATURES; planned ones go in COMING_SOON.
 */
export type PlanKey = 'SOLO' | 'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE';
export const PLAN_ORDER: PlanKey[] = ['SOLO', 'STARTER', 'GROWTH_PRO', 'ENTERPRISE'];

export type PlanLimits = {
  name: string;
  leadLimit: number;
  seatLimit: number;
  automationRunLimit: number;
};

/** Shown as "Unlimited" in the UI; a large number keeps limit checks simple. */
export const UNLIMITED = 1_000_000;

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  SOLO: { name: 'Solo', leadLimit: 500, seatLimit: 1, automationRunLimit: 0 },
  STARTER: { name: 'Starter', leadLimit: 2500, seatLimit: 3, automationRunLimit: 300 },
  GROWTH_PRO: { name: 'Growth Pro', leadLimit: 15000, seatLimit: 10, automationRunLimit: 5000 },
  ENTERPRISE: { name: 'Enterprise Scale', leadLimit: UNLIMITED, seatLimit: 30, automationRunLimit: 50000 },
};

/** Other numeric limits, enforced server-side. */
export const PLAN_QUOTAS: Record<PlanKey, { automationRules: number; apiKeys: number; proposalsPerMonth: number; customFields: number; mpesaAccounts: number; mpesaRequestsPerMonth: number }> = {
  SOLO: { automationRules: 0, apiKeys: 0, proposalsPerMonth: 5, customFields: 0, mpesaAccounts: 1, mpesaRequestsPerMonth: 30 },
  STARTER: { automationRules: 5, apiKeys: 0, proposalsPerMonth: UNLIMITED, customFields: 5, mpesaAccounts: 1, mpesaRequestsPerMonth: UNLIMITED },
  GROWTH_PRO: { automationRules: UNLIMITED, apiKeys: 10, proposalsPerMonth: UNLIMITED, customFields: UNLIMITED, mpesaAccounts: 3, mpesaRequestsPerMonth: UNLIMITED },
  ENTERPRISE: { automationRules: UNLIMITED, apiKeys: 50, proposalsPerMonth: UNLIMITED, customFields: UNLIMITED, mpesaAccounts: UNLIMITED, mpesaRequestsPerMonth: UNLIMITED },
};

/** Backwards-compatible alias used by the developer keys route. */
export const API_KEY_LIMITS: Record<PlanKey, number> = {
  SOLO: PLAN_QUOTAS.SOLO.apiKeys,
  STARTER: PLAN_QUOTAS.STARTER.apiKeys,
  GROWTH_PRO: PLAN_QUOTAS.GROWTH_PRO.apiKeys,
  ENTERPRISE: PLAN_QUOTAS.ENTERPRISE.apiKeys,
};

/** Features that exist today, and the lowest plan that includes each one. */
export const FEATURES = {
  mpesa_payments: { label: 'M-Pesa payment requests & links', minPlan: 'SOLO' },
  mpesa_reconciliation: { label: 'M-Pesa auto-reconciliation for your Paybill or Till', minPlan: 'STARTER' },
  instalment_plans: { label: 'Instalment plans, payment reminders & debtor ageing', minPlan: 'GROWTH_PRO' },
  sms: { label: 'Bulk SMS & SMS reminders (prepaid credits)', minPlan: 'STARTER' },
  sms_sender_id: { label: 'Your own SMS sender name', minPlan: 'ENTERPRISE' },
  email_inbox: { label: 'Team inbox for your own email address', minPlan: 'STARTER' },
  automations: { label: 'Workflow automations', minPlan: 'STARTER' },
  whatsapp: { label: 'WhatsApp Business API inbox', minPlan: 'GROWTH_PRO' },
  customer_success: { label: 'Customer success & renewal tracking', minPlan: 'GROWTH_PRO' },
  deal_insights: { label: 'Deal insights & suggested next steps', minPlan: 'GROWTH_PRO' },
  developer_api: { label: 'Developer API & webhooks', minPlan: 'GROWTH_PRO' },
} as const satisfies Record<string, { label: string; minPlan: PlanKey }>;

export type Feature = keyof typeof FEATURES;

export function normalizePlan(value: unknown, fallback: PlanKey = 'GROWTH_PRO'): PlanKey {
  return PLAN_ORDER.includes(value as PlanKey) ? (value as PlanKey) : fallback;
}

/** Does this plan include the feature? Unknown plans are treated as Growth Pro (the trial default). */
export function planHasFeature(plan: unknown, feature: Feature): boolean {
  return PLAN_ORDER.indexOf(normalizePlan(plan)) >= PLAN_ORDER.indexOf(FEATURES[feature].minPlan);
}

export type PlanDetails = PlanLimits & {
  key: PlanKey;
  /** KES per month: `monthly` when billed monthly, `annual` when billed yearly. */
  priceKes: { monthly: number; annual: number };
  description: string;
  popular?: boolean;
  /** Plan-specific lines: limits, unlocked features and support level. */
  features: string[];
  comingSoon: string[];
};

const n = (value: number) => (value >= UNLIMITED ? 'Unlimited' : value.toLocaleString('en-US'));
const featuresFor = (key: PlanKey) =>
  (Object.keys(FEATURES) as Feature[]).filter((f) => FEATURES[f].minPlan === key).map((f) => FEATURES[f].label);
const limitLines = (key: PlanKey) => {
  const p = PLAN_LIMITS[key];
  const q = PLAN_QUOTAS[key];
  return [
    `${n(p.leadLimit)} active leads`,
    p.seatLimit === 1 ? '1 user' : `Up to ${p.seatLimit} team members`,
    q.automationRules ? `${q.automationRules >= UNLIMITED ? 'Unlimited' : q.automationRules} automation rules · ${n(p.automationRunLimit)} runs / month` : null,
    q.proposalsPerMonth < UNLIMITED ? `${q.proposalsPerMonth} proposals / month` : 'Unlimited proposals',
    q.customFields ? `${q.customFields >= UNLIMITED ? 'Unlimited' : q.customFields} custom lead fields` : null,
    q.mpesaRequestsPerMonth < UNLIMITED ? `${q.mpesaRequestsPerMonth} M-Pesa payment requests / month` : null,
    `${q.mpesaAccounts >= UNLIMITED ? 'Unlimited' : q.mpesaAccounts} M-Pesa Paybill/Till${q.mpesaAccounts === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];
};

export const PLANS: Record<PlanKey, PlanDetails> = {
  SOLO: {
    key: 'SOLO',
    ...PLAN_LIMITS.SOLO,
    priceKes: { monthly: 1500, annual: 1200 },
    description: 'For one-person businesses (agents, consultants, freelancers) moving out of WhatsApp chats and notebooks.',
    features: [...limitLines('SOLO'), ...featuresFor('SOLO'), 'Help centre support'],
    comingSoon: [],
  },
  STARTER: {
    key: 'STARTER',
    ...PLAN_LIMITS.STARTER,
    priceKes: { monthly: 3900, annual: 3200 },
    description: 'For small teams that want every enquiry in one inbox and follow-ups that happen on their own.',
    features: ['Everything in Solo', ...limitLines('STARTER'), ...featuresFor('STARTER'), 'Email support'],
    comingSoon: [],
  },
  GROWTH_PRO: {
    key: 'GROWTH_PRO',
    ...PLAN_LIMITS.GROWTH_PRO,
    priceKes: { monthly: 11900, annual: 9900 },
    description: 'For sales and collections teams that run on WhatsApp and need automation without limits.',
    popular: true,
    features: ['Everything in Starter', ...limitLines('GROWTH_PRO'), ...featuresFor('GROWTH_PRO'), 'Priority email & WhatsApp support'],
    comingSoon: ['KRA eTIMS invoicing', 'AI reply assistant'],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    ...PLAN_LIMITS.ENTERPRISE,
    priceKes: { monthly: 34900, annual: 29900 },
    description: 'For multi-branch businesses that need high volume, more seats and hands-on onboarding.',
    features: ['Everything in Growth Pro', ...limitLines('ENTERPRISE'), ...featuresFor('ENTERPRISE'), `${PLAN_QUOTAS.ENTERPRISE.apiKeys} developer API keys`, 'Guided onboarding & priority support'],
    comingSoon: ['Multiple branches & WhatsApp numbers', 'Audit log export', 'Custom roles'],
  },
};

/** Included in every plan. Keep to features that work today. */
export const SHARED_FEATURES = [
  'Visual deal pipeline with custom stages',
  'Leads, tasks & calendar',
  'Proposals with status tracking',
  'Reports with CSV export',
  'Mobile-friendly workspace',
];

/** Yearly saving in KES when paying annually instead of monthly. */
export const annualSavingsKes = (plan: PlanDetails) => (plan.priceKes.monthly - plan.priceKes.annual) * 12;
