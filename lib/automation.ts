export const ACTIVE_PIPELINE_STAGES = ['NEW_LEAD', 'RESEARCHING', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PROPOSAL'] as const;
const AUTO_FOLLOW_UP_MARKER = '[AUTO_FOLLOW_UP]';

export async function logLeadActivity(
  tx: any,
  leadId: string,
  type: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  return tx.activityEvent.create({
    data: { leadId, type, action, metadata: metadata as any },
  });
}

export async function createAutomaticFollowUpTask(
  tx: any,
  input: { leadId: string; dueDate: Date; assignedToId?: string | null; outreachType: string; subject?: string | null }
) {
  const existing = await tx.task.findFirst({
    where: {
      leadId: input.leadId,
      completed: false,
      dueDate: input.dueDate,
      description: { contains: AUTO_FOLLOW_UP_MARKER },
    },
  });
  if (existing) return { task: existing, created: false };

  const task = await tx.task.create({
    data: {
      leadId: input.leadId,
      assignedToId: input.assignedToId || null,
      title: `Follow up with ${input.subject?.trim() || 'lead'}`,
      description: `${AUTO_FOLLOW_UP_MARKER} Automatically created from ${input.outreachType.toLowerCase()} outreach.`,
      dueDate: input.dueDate,
      priority: 'medium',
    },
  });
  return { task, created: true };
}

export function isActiveStage(stage: string) {
  return (ACTIVE_PIPELINE_STAGES as readonly string[]).includes(stage);
}
