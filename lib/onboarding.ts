import { Prisma } from '@prisma/client';

export async function initializeWorkspaceOnboarding(tx: Prisma.TransactionClient, input: { organizationId: string; organizationSlug: string; userId: string; currency: string }) {
  const suffix = `${input.organizationSlug.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'workspace'}-${input.organizationId.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  const leads = [
    { companyName: 'Northstar Properties', contactName: 'Alex Morgan', email: `alex.${suffix}@sample.stratencrm.local`, dealValue: 25000, pipelineStage: 'NEW_LEAD' as const, leadSource: 'WEBSITE_FORM' as const, location: 'Sample City', notes: 'Starter lead: qualify the opportunity and make first contact.' },
    { companyName: 'Blue Harbor Group', contactName: 'Jordan Lee', email: `jordan.${suffix}@sample.stratencrm.local`, dealValue: 48000, pipelineStage: 'CONTACTED' as const, leadSource: 'REFERRAL' as const, location: 'Sample City', notes: 'Starter lead: follow up after the discovery call.' },
    { companyName: 'Summit Developments', contactName: 'Taylor Reed', email: `taylor.${suffix}@sample.stratencrm.local`, dealValue: 76000, pipelineStage: 'PROPOSAL' as const, leadSource: 'COLD_OUTREACH' as const, location: 'Sample City', notes: 'Starter lead: review the example proposal stage.' },
  ];
  await tx.lead.createMany({ data: leads.map((lead) => ({ ...lead, organizationId: input.organizationId, assignedToId: input.userId })) });

  const checklist = [
    ['Welcome to your Straten CRM workspace', 'Take a quick tour of your starter pipeline and sample leads.', 'high'],
    ['Review the starter pipeline', 'Move a sample deal through the stages to learn the Kanban workflow.', 'high'],
    ['Add your first real lead', 'Create a live prospect and replace the sample data when ready.', 'medium'],
    ['Invite your team', 'Use Team Management to send secure invitations to colleagues.', 'medium'],
    ['Configure your workspace', `Review currency (${input.currency}) and subscription settings.`, 'low'],
  ] as const;
  await tx.task.createMany({ data: checklist.map(([title, description, priority], index) => ({ title, description, priority, completed: false, dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000), organizationId: input.organizationId, assignedToId: input.userId })) });
}
