import prisma from './prisma';
import { DEFAULT_PIPELINE_STAGES } from '@/lib/pipelineStages';

export type StageGroups = { all: string[]; active: string[]; won: string[]; lost: string[] };

type StageRow = { key: string; category: string };

/** Pure grouping, in pipeline order. Exported for tests. */
export function groupStages(rows: StageRow[]): StageGroups {
  const list = rows.length ? rows : DEFAULT_PIPELINE_STAGES;
  return {
    all: list.map((s) => s.key),
    active: list.filter((s) => s.category === 'ACTIVE').map((s) => s.key),
    won: list.filter((s) => s.category === 'WON').map((s) => s.key),
    lost: list.filter((s) => s.category === 'LOST').map((s) => s.key),
  };
}

/**
 * A workspace's pipeline stages grouped by category. Workspaces that never customised their
 * pipeline use the default stages. Use categories (not hard-coded keys like 'WON') so renamed
 * or custom stages keep working.
 */
export async function getStageGroups(organizationId: string | null | undefined): Promise<StageGroups> {
  const rows = organizationId
    ? await prisma.pipelineStageConfig.findMany({ where: { organizationId }, orderBy: { order: 'asc' }, select: { key: true, category: true } })
    : [];
  return groupStages(rows);
}

/**
 * The stage to move a lead to when something happens (e.g. first contact), or undefined to leave it.
 * Only moves forward, only from an active stage, and only if the target stage exists in this workspace.
 */
export function advanceStage(groups: StageGroups, current: string, target: string): string | undefined {
  const from = groups.all.indexOf(current);
  const to = groups.all.indexOf(target);
  if (to < 0 || from < 0 || from >= to || !groups.active.includes(current)) return undefined;
  return target;
}
