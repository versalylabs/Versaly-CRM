import { blockIfReadOnly } from '../../../../lib/subscription';
import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { logLeadActivity } from '../../../../lib/automation';
import { getManagerIds, notifyMany, proposalHref } from '../../../../lib/notifications';
import { getOrgContext, unauthorized } from '../../../../lib/tenant';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';

const LEAD_SELECT = { id: true, contactName: true, companyName: true, email: true } as const;

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const proposals = await prisma.proposal.findMany({
      where: { organizationId: ctx.orgId },
      include: { lead: { select: LEAD_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(proposals);
  } catch (error) {
    console.error('Failed to fetch proposals:', error);
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const blocked = await assertSubscriptionWriteAccess(ctx.orgId);
    if (blocked) return NextResponse.json({ error: blocked.reason || 'Workspace is read-only.' }, { status: 402 });

    const body = await request.json();
    if (!body.leadId || !body.title?.trim()) {
      return NextResponse.json({ error: 'Lead and proposal title are required' }, { status: 400 });
    }
    // The lead must belong to the caller's workspace.
    const lead = await prisma.lead.findFirst({ where: { id: String(body.leadId), organizationId: ctx.orgId }, select: { id: true, assignedToId: true } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const value = body.value === '' || body.value == null ? null : Number(body.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Proposal value must be a valid positive number' }, { status: 400 });
    }
    const status = ['draft', 'sent', 'accepted', 'rejected'].includes(body.status) ? body.status : 'draft';

    const proposal = await prisma.proposal.create({
      data: {
        organizationId: ctx.orgId,
        leadId: lead.id,
        title: String(body.title).trim(),
        description: body.description?.trim() || null,
        value,
        status,
        sentAt: status === 'sent' ? new Date() : null,
      },
      include: { lead: { select: LEAD_SELECT } },
    });
    await prisma.$transaction(async (tx) => {
      if (proposal.status === 'sent') await tx.lead.update({ where: { id: lead.id }, data: { pipelineStage: 'PROPOSAL', lastContact: new Date() } });
      await logLeadActivity(tx, lead.id, 'PROPOSAL', `Proposal ${proposal.status}`, { proposalId: proposal.id, title: proposal.title, value: proposal.value });
    });
    if (proposal.status === 'sent') {
      const managers = await getManagerIds(ctx.orgId);
      await notifyMany([lead.assignedToId, ...managers], { type: 'PROPOSAL_SENT', title: 'Proposal sent', message: `"${proposal.title}" was sent.`, href: proposalHref(), category: 'proposal' });
    }
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error('Failed to create proposal:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
