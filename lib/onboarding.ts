import { Prisma } from '@prisma/client';

export async function initializeWorkspaceOnboarding(tx: Prisma.TransactionClient, input: { organizationId: string; organizationSlug: string; userId: string; currency: string }) {
  const suffix = `${input.organizationSlug.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'workspace'}-${input.organizationId.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  // Workspaces start with a clean, blank slate (zero placeholder leads)

  const checklist = [
    ['Welcome to your Versaly CRM workspace', 'Take a quick tour of your starter pipeline and sample leads.', 'high'],
    ['Review the starter pipeline', 'Move a sample deal through the stages to learn the Kanban workflow.', 'high'],
    ['Add your first real lead', 'Create a live prospect and replace the sample data when ready.', 'medium'],
    ['Invite your team', 'Use Team Management to send secure invitations to colleagues.', 'medium'],
    ['Configure your workspace', `Review currency (${input.currency}) and subscription settings.`, 'low'],
  ] as const;
  await tx.task.createMany({ data: checklist.map(([title, description, priority], index) => ({ title, description, priority, completed: false, dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000), organizationId: input.organizationId, assignedToId: input.userId })) });
}
