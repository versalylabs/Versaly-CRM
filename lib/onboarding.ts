import { Prisma } from '@prisma/client';

export async function initializeWorkspaceOnboarding(tx: Prisma.TransactionClient, input: { organizationId: string; organizationSlug: string; userId: string; currency: string }) {
  const suffix = `${input.organizationSlug.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'workspace'}-${input.organizationId.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  // Workspaces start with a clean, blank slate (zero placeholder leads)

  const checklist = [
    ['Add your first lead', 'Go to Leads and add a customer or prospect you are working with now.', 'high'],
    ['Set up your pipeline stages', 'In Settings → Pipeline, rename or reorder stages to match how you sell.', 'high'],
    ['Connect your email or WhatsApp', 'Open the Inbox and connect an account so customer messages arrive in one place.', 'medium'],
    ['Invite your team', 'Use Users & Roles to send secure invitations to colleagues.', 'medium'],
    ['Check your workspace settings', `Confirm your currency (${input.currency}) and review your plan in Settings → Billing.`, 'low'],
  ] as const;
  await tx.task.createMany({ data: checklist.map(([title, description, priority], index) => ({ title, description, priority, completed: false, dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000), organizationId: input.organizationId, assignedToId: input.userId })) });
}
