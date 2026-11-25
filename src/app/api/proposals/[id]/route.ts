import { blockIfReadOnly } from '../../../../../lib/subscription';
import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getOrgContext, unauthorized } from '../../../../../lib/tenant';
import { afterProposalStatusChange, newShareToken, nextSequence, totalsFrom } from '@/lib/documents';
import { docNumber } from '@/lib/quotes';
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
    if (body.value !== undefined && body.items === undefined) {
      const value = body.value === '' || body.value == null ? null : Number(body.value);
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: 'Proposal value must be a valid positive number' }, { status: 400 });
      }
      data.value = value;
    }
    if (body.items !== undefined) {
      if (existing.acceptedAt) return NextResponse.json({ error: 'This quote was accepted by the client. Create a new quote to change it.' }, { status: 409 });
      try {
        const t = totalsFrom(body.items);
        Object.assign(data, { items: t.items, subtotal: t.subtotal, vatTotal: t.vatTotal, value: t.total });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (!existing.number) data.number = docNumber('Q', await nextSequence(ctx.orgId, 'quote'));
      if (!existing.shareToken) data.shareToken = newShareToken();
    }
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (data.validUntil && Number.isNaN(data.validUntil.getTime())) return NextResponse.json({ error: 'Invalid "valid until" date.' }, { status: 400 });
    if (body.terms !== undefined) data.terms = String(body.terms || '').slice(0, 4000) || null;
    // Compare against the stored status, never a client-supplied "previousStatus".
    const changed = data.status !== undefined && data.status !== existing.status;
    if (changed && data.status === 'sent') data.sentAt = new Date();
    if (changed && ['accepted', 'rejected'].includes(data.status)) data.respondedAt = new Date();

    const proposal = await prisma.proposal.update({ where: { id: existing.id }, data, include: { lead: true } });
    if (changed) await afterProposalStatusChange(proposal.id, data.status);
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
