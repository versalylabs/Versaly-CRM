import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { blockIfReadOnly } from '@/lib/subscription';
import { getStageGroups } from '@/lib/stages';

const MAX_IDS = 500;

/**
 * Act on many leads at once: { ids, action: 'assign' | 'stage' | 'delete', assignedToId?, stage? } -> { count }.
 * Only leads in the caller's workspace are touched; unknown ids are ignored.
 */
export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can update leads in bulk.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.map(String))) : [];
  if (!ids.length) return NextResponse.json({ error: 'Select at least one lead.' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `Select up to ${MAX_IDS} leads at a time.` }, { status: 400 });
  const where = { id: { in: ids as string[] }, organizationId: ctx.orgId };

  if (body.action === 'delete') {
    const { count } = await prisma.lead.deleteMany({ where });
    return NextResponse.json({ count });
  }

  if (body.action === 'assign') {
    const assignedToId = body.assignedToId ? String(body.assignedToId) : null;
    if (assignedToId) {
      const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId: ctx.orgId, isActive: true }, select: { id: true } });
      if (!user) return NextResponse.json({ error: 'That team member was not found.' }, { status: 400 });
    }
    const { count } = await prisma.lead.updateMany({ where, data: { assignedToId } });
    return NextResponse.json({ count });
  }

  if (body.action === 'stage') {
    const stage = String(body.stage || '');
    if (!(await getStageGroups(ctx.orgId)).all.includes(stage)) return NextResponse.json({ error: 'Choose a pipeline stage.' }, { status: 400 });
    const { count } = await prisma.lead.updateMany({ where, data: { pipelineStage: stage } });
    return NextResponse.json({ count });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
