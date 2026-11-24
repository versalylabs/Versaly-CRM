import { blockIfReadOnly } from '../../../../../lib/subscription';
import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';
import { getManagerIds, notifyMany, proposalHref } from '../../../../../lib/notifications';
import { getOrgContext, unauthorized } from '../../../../../lib/tenant';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const blocked = await assertSubscriptionWriteAccess(ctx.orgId);
    if (blocked) return NextResponse.json({ error: blocked.reason || 'Workspace is read-only.' }, { status: 402 });

    const existing = await prisma.proposal.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
    if (!existing) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};
    for (const key of ['title', 'description']) if (body[key] !== undefined) data[key] = body[key];
    if (body.status !== undefined) {
      if (!['draft', 'sent', 'accepted', 'rejected'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid proposal status' }, { status: 400 });
      }
      data.status = body.status;
    }
    if (body.leadId !== undefined && body.leadId !== existing.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: String(body.leadId), organizationId: ctx.orgId }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      data.leadId = lead.id;
    }
    if (body.value !== undefined) {
      const value = body.value === '' || body.value == null ? null : Number(body.value);
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: 'Proposal value must be a valid positive number' }, { status: 400 });
      }
      data.value = value;
    }
    // Compare against the stored status, never a client-supplied "previousStatus".
    const changed = data.status !== undefined && data.status !== existing.status;
    if (changed && data.status === 'sent') data.sentAt = new Date();
    if (changed && ['accepted', 'rejected'].includes(data.status)) data.respondedAt = new Date();

    const proposal = await prisma.proposal.update({ where: { id: existing.id }, data, include: { lead: true } });
    await prisma.$transaction(async (tx) => {
      if (changed && data.status === 'sent') await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: 'PROPOSAL', lastContact: new Date() } });
      if (changed && data.status === 'accepted') await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: 'WON', lastContact: new Date() } });
      if (changed && data.status === 'rejected') await tx.lead.update({ where: { id: proposal.leadId }, data: { pipelineStage: 'LOST', lastContact: new Date() } });
      if (changed) await logLeadActivity(tx, proposal.leadId, 'PROPOSAL', `Proposal ${data.status}`, { proposalId: proposal.id, title: proposal.title, value: proposal.value });
    });
    if (changed && ['sent', 'accepted', 'rejected'].includes(data.status)) {
      const managers = await getManagerIds(ctx.orgId);
      const label = data.status === 'accepted' ? 'Proposal accepted' : data.status === 'rejected' ? 'Proposal rejected' : 'Proposal sent';
      await notifyMany([proposal.lead?.assignedToId, ...managers], { type: `PROPOSAL_${String(data.status).toUpperCase()}`, title: label, message: `"${proposal.title}" was ${data.status}.`, href: proposalHref(), category: 'proposal' });
    }
    return NextResponse.json(proposal);
  } catch (error) {
    console.error('Failed to update proposal:', error);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const result = await prisma.proposal.deleteMany({ where: { id: params.id, organizationId: ctx.orgId } });
    if (!result.count) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 });
  }
}
