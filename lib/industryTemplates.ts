/**
 * Starter pipelines by industry, offered at signup and in the setup wizard.
 * Applying one replaces the workspace's stages, so it is only allowed while the workspace has no leads.
 */
type Stage = { key: string; label: string; category: 'ACTIVE' | 'WON' | 'LOST'; probability: number; color: string };

export type IndustryTemplate = { key: string; label: string; description: string; stages: Stage[] };

const s = (key: string, label: string, probability: number, color: string, category: Stage['category'] = 'ACTIVE'): Stage => ({ key, label, category, probability, color });

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    key: 'general',
    label: 'General sales / services',
    description: 'A simple sales pipeline for most businesses.',
    stages: [s('NEW_LEAD', 'New lead', 10, 'slate'), s('CONTACTED', 'Contacted', 25, 'blue'), s('FOLLOW_UP', 'Follow-up', 40, 'amber'), s('PROPOSAL', 'Quote sent', 60, 'purple'), s('WON', 'Won', 100, 'emerald', 'WON'), s('LOST', 'Lost', 0, 'rose', 'LOST')],
  },
  {
    key: 'real_estate',
    label: 'Real estate & property',
    description: 'Enquiries, viewings, offers and closing (rentals or sales).',
    stages: [s('ENQUIRY', 'Enquiry', 10, 'slate'), s('VIEWING_BOOKED', 'Viewing booked', 30, 'blue'), s('VIEWED', 'Viewed', 45, 'cyan'), s('OFFER', 'Offer / negotiation', 65, 'amber'), s('DEPOSIT_PAID', 'Deposit paid', 85, 'purple'), s('CLOSED', 'Closed / moved in', 100, 'emerald', 'WON'), s('LOST', 'Not proceeding', 0, 'rose', 'LOST')],
  },
  {
    key: 'schools',
    label: 'Schools & training',
    description: 'From parent or student enquiry to admission and first fees.',
    stages: [s('ENQUIRY', 'Enquiry', 10, 'slate'), s('VISIT', 'School visit / tour', 30, 'blue'), s('APPLIED', 'Application received', 50, 'cyan'), s('ASSESSMENT', 'Assessment / interview', 65, 'amber'), s('ADMITTED', 'Admitted', 85, 'purple'), s('ENROLLED', 'Fees paid & enrolled', 100, 'emerald', 'WON'), s('LOST', 'Did not join', 0, 'rose', 'LOST')],
  },
  {
    key: 'sacco',
    label: 'SACCO, chama & microfinance',
    description: 'Member recruitment and loan applications.',
    stages: [s('ENQUIRY', 'Enquiry', 10, 'slate'), s('DOCUMENTS', 'Documents & KYC', 30, 'blue'), s('APPRAISAL', 'Appraisal', 50, 'cyan'), s('APPROVED', 'Approved', 80, 'amber'), s('DISBURSED', 'Joined / disbursed', 100, 'emerald', 'WON'), s('DECLINED', 'Declined / dropped', 0, 'rose', 'LOST')],
  },
  {
    key: 'solar_payg',
    label: 'Solar, PAYG & asset finance',
    description: 'Site survey to installation and first instalment.',
    stages: [s('LEAD', 'Lead', 10, 'slate'), s('SURVEY', 'Site survey', 30, 'blue'), s('QUOTE', 'Quote sent', 50, 'cyan'), s('DEPOSIT', 'Deposit paid', 75, 'amber'), s('INSTALLED', 'Installed', 100, 'emerald', 'WON'), s('LOST', 'Lost', 0, 'rose', 'LOST')],
  },
  {
    key: 'insurance',
    label: 'Insurance agency',
    description: 'Quotes, proposals and policy issue.',
    stages: [s('LEAD', 'Lead', 10, 'slate'), s('NEEDS', 'Needs analysis', 30, 'blue'), s('QUOTED', 'Quoted', 50, 'cyan'), s('PROPOSAL_FORM', 'Proposal form signed', 75, 'amber'), s('ISSUED', 'Policy issued', 100, 'emerald', 'WON'), s('LOST', 'Lost', 0, 'rose', 'LOST')],
  },
  {
    key: 'car_dealers',
    label: 'Car dealers & hire purchase',
    description: 'From enquiry and test drive to financing and handover.',
    stages: [s('ENQUIRY', 'Enquiry', 10, 'slate'), s('TEST_DRIVE', 'Test drive', 30, 'blue'), s('FINANCING', 'Financing / logbook checks', 55, 'cyan'), s('DEPOSIT', 'Deposit paid', 80, 'amber'), s('DELIVERED', 'Car delivered', 100, 'emerald', 'WON'), s('LOST', 'Lost', 0, 'rose', 'LOST')],
  },
];

export const findTemplate = (key: unknown) => INDUSTRY_TEMPLATES.find((t) => t.key === key) || null;

/** Replaces the workspace's pipeline stages with a template's. Callers must check the workspace has no leads. */
export async function applyIndustryTemplate(tx: any, organizationId: string, key: string) {
  const template = findTemplate(key);
  if (!template) return false;
  await tx.pipelineStageConfig.deleteMany({ where: { organizationId } });
  await tx.pipelineStageConfig.createMany({
    data: template.stages.map((st, order) => ({ ...st, order, organizationId })),
  });
  await tx.organization.update({ where: { id: organizationId }, data: { industry: key } });
  return true;
}
