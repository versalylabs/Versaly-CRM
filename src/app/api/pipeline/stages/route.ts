import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DEFAULT_PIPELINE_STAGES, slugifyStageKey, PipelineStageItem } from '@/lib/pipelineStages';

async function resolveOrganizationId(session: any): Promise<string | null> {
  if (session?.user?.organizationId) return session.user.organizationId;
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { organizationId: true },
    });
    if (user?.organizationId) return user.organizationId;
  }
  const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
  return defaultOrg?.id || null;
}

// GET /api/pipeline/stages
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);

  // Fetch configured stages for this organization
  let stages = organizationId
    ? await prisma.pipelineStageConfig.findMany({
        where: { organizationId },
        orderBy: { order: 'asc' },
      })
    : [];

  // If no custom stages exist in database yet, return defaults
  const isCustomized = stages.length > 0;
  const effectiveStages = isCustomized
    ? stages.map((s) => ({
        id: s.id,
        key: s.key,
        label: s.label,
        probability: s.probability,
        color: s.color,
        category: s.category as 'ACTIVE' | 'WON' | 'LOST',
        order: s.order,
        isDefault: false,
      }))
    : DEFAULT_PIPELINE_STAGES.map((s: PipelineStageItem, idx: number) => ({
        id: `default-${s.key}`,
        ...s,
        order: idx,
        isDefault: true,
      }));

  // Fetch lead counts and total values grouped by pipelineStage
  const leadGroups = await prisma.lead.groupBy({
    by: ['pipelineStage'],
    where: organizationId ? { organizationId } : {},
    _count: { _all: true },
    _sum: { dealValue: true },
  });

  const leadCountsByStage: Record<string, { count: number; totalValue: number }> = {};
  leadGroups.forEach((g) => {
    leadCountsByStage[g.pipelineStage] = {
      count: g._count._all,
      totalValue: g._sum.dealValue || 0,
    };
  });

  return NextResponse.json({
    stages: effectiveStages,
    isCustomized,
    leadCounts: leadCountsByStage,
  });
}

// POST /api/pipeline/stages - Create a new custom stage
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization workspace not found.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const label = String(body.label || '').trim();
    if (!label) {
      return NextResponse.json({ error: 'Stage name / label is required.' }, { status: 400 });
    }

    let key = body.key ? slugifyStageKey(String(body.key)) : slugifyStageKey(label);
    const probability = Math.max(0, Math.min(100, Number(body.probability ?? 50)));
    const color = String(body.color || 'blue');
    const category = ['ACTIVE', 'WON', 'LOST'].includes(body.category) ? body.category : 'ACTIVE';

    // If organization doesn't have custom stages seeded in table yet, seed defaults first
    const existingCount = await prisma.pipelineStageConfig.count({
      where: { organizationId },
    });

    if (existingCount === 0) {
      for (const defStage of DEFAULT_PIPELINE_STAGES) {
        await prisma.pipelineStageConfig.create({
          data: {
            organizationId,
            key: defStage.key,
            label: defStage.label,
            probability: defStage.probability,
            color: defStage.color,
            category: defStage.category,
            order: defStage.order,
          },
        });
      }
    }

    // Check if key already exists in organization, if so append random suffix
    const existingWithKey = await prisma.pipelineStageConfig.findFirst({
      where: { organizationId, key },
    });
    if (existingWithKey) {
      key = `${key}_${Math.floor(Math.random() * 900 + 100)}`;
    }

    // Determine order: place before WON/LOST or at the end
    let order = typeof body.order === 'number' ? body.order : -1;
    if (order < 0) {
      const highestActive = await prisma.pipelineStageConfig.findFirst({
        where: { organizationId, category: 'ACTIVE' },
        orderBy: { order: 'desc' },
      });
      order = highestActive ? highestActive.order + 1 : 0;
    }

    // Shift any stages with order >= order up by 1
    await prisma.pipelineStageConfig.updateMany({
      where: { organizationId, order: { gte: order } },
      data: { order: { increment: 1 } },
    });

    const newStage = await prisma.pipelineStageConfig.create({
      data: {
        organizationId,
        key,
        label,
        probability,
        color,
        category,
        order,
      },
    });

    return NextResponse.json(newStage, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create pipeline stage.' },
      { status: 500 }
    );
  }
}

// PATCH /api/pipeline/stages - Edit a stage, reorder, or reset to defaults
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization workspace not found.' }, { status: 400 });
  }

  try {
    const body = await req.json();

    // 1. Reset to defaults
    if (body.action === 'reset') {
      await prisma.pipelineStageConfig.deleteMany({
        where: { organizationId },
      });

      for (const defStage of DEFAULT_PIPELINE_STAGES) {
        await prisma.pipelineStageConfig.create({
          data: {
            organizationId,
            key: defStage.key,
            label: defStage.label,
            probability: defStage.probability,
            color: defStage.color,
            category: defStage.category,
            order: defStage.order,
          },
        });
      }

      return NextResponse.json({ success: true, message: 'Stages reset to default configuration.' });
    }

    // 2. Reorder stages
    if (Array.isArray(body.reorder)) {
      // [{ id, order }]
      for (const item of body.reorder) {
        if (item.id && typeof item.order === 'number') {
          await prisma.pipelineStageConfig.updateMany({
            where: { id: item.id, organizationId },
            data: { order: item.order },
          });
        }
      }
      return NextResponse.json({ success: true, message: 'Stages reordered successfully.' });
    }

    // 3. Update single stage
    const stageId = body.id || body.stageId;
    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required for update.' }, { status: 400 });
    }

    // If modifying a virtual default stage that has not been saved in db yet, seed first
    let stage = await prisma.pipelineStageConfig.findFirst({
      where: { id: stageId, organizationId },
    });

    if (!stage && String(stageId).startsWith('default-')) {
      const defKey = String(stageId).replace('default-', '');
      // Seed all default stages to DB
      for (const defStage of DEFAULT_PIPELINE_STAGES) {
        await prisma.pipelineStageConfig.create({
          data: {
            organizationId,
            key: defStage.key,
            label: defStage.label,
            probability: defStage.probability,
            color: defStage.color,
            category: defStage.category,
            order: defStage.order,
          },
        });
      }
      stage = await prisma.pipelineStageConfig.findFirst({
        where: { key: defKey, organizationId },
      });
    }

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ error: 'Stage name cannot be empty.' }, { status: 400 });
      updateData.label = label;
    }
    if (body.probability !== undefined) {
      updateData.probability = Math.max(0, Math.min(100, Number(body.probability)));
    }
    if (body.color !== undefined) {
      updateData.color = String(body.color);
    }
    if (body.category !== undefined && ['ACTIVE', 'WON', 'LOST'].includes(body.category)) {
      updateData.category = body.category;
    }
    if (typeof body.order === 'number') {
      updateData.order = body.order;
    }

    const updated = await prisma.pipelineStageConfig.update({
      where: { id: stage.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update pipeline stage.' },
      { status: 500 }
    );
  }
}

// DELETE /api/pipeline/stages - Delete a stage with optional lead reassignment
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization workspace not found.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const stageId = searchParams.get('id');
  const stageKey = searchParams.get('key');
  const reassignTo = searchParams.get('reassignTo'); // e.g. "NEW_LEAD" or other stage key

  if (!stageId && !stageKey) {
    return NextResponse.json({ error: 'Stage id or key is required for deletion.' }, { status: 400 });
  }

  try {
    // If table is still empty, seed defaults before deleting
    const existingCount = await prisma.pipelineStageConfig.count({ where: { organizationId } });
    if (existingCount === 0) {
      for (const defStage of DEFAULT_PIPELINE_STAGES) {
        await prisma.pipelineStageConfig.create({
          data: {
            organizationId,
            key: defStage.key,
            label: defStage.label,
            probability: defStage.probability,
            color: defStage.color,
            category: defStage.category,
            order: defStage.order,
          },
        });
      }
    }

    const whereClause: any = { organizationId };
    if (stageId && !String(stageId).startsWith('default-')) {
      whereClause.id = stageId;
    } else if (stageKey) {
      whereClause.key = stageKey;
    } else if (stageId && String(stageId).startsWith('default-')) {
      whereClause.key = String(stageId).replace('default-', '');
    }

    const stage = await prisma.pipelineStageConfig.findFirst({ where: whereClause });
    if (!stage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
    }

    // Safety: ensure at least 2 stages remain
    const totalRemaining = await prisma.pipelineStageConfig.count({ where: { organizationId } });
    if (totalRemaining <= 2) {
      return NextResponse.json(
        { error: 'You must maintain at least two stages in your pipeline.' },
        { status: 400 }
      );
    }

    // Reassign existing leads if requested
    if (reassignTo) {
      await prisma.lead.updateMany({
        where: {
          organizationId,
          pipelineStage: stage.key,
        },
        data: {
          pipelineStage: reassignTo,
        },
      });
    }

    // Delete the stage configuration
    await prisma.pipelineStageConfig.delete({
      where: { id: stage.id },
    });

    return NextResponse.json({
      success: true,
      message: `Stage "${stage.label}" deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete pipeline stage.' },
      { status: 500 }
    );
  }
}
