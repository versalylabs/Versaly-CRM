import { PLAN_QUOTAS, UNLIMITED, normalizePlan } from '../../../../lib/plans';
import { blockIfReadOnly } from '../../../../lib/subscription';
import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { afterProposalStatusChange, newShareToken, nextSequence, totalsFrom } from '@/lib/documents';
import { docNumber } from '@/lib/quotes';
import { getOrgContext, unauthorized } from '../../../../lib/tenant';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';

const LEAD_SELECT = { id: true, contactName: true, companyName: true, email: true } as const;

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const proposals = await prisma.proposal.findMany({
      where: { organizationId: ctx.orgId },
      include: { lead: { select: { ...LEAD_SELECT, phone: true } }, invoice: { select: { id: true, number: true } } },
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

    const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true } });
    const monthly = PLAN_QUOTAS[normalizePlan(org?.plan)].proposalsPerMonth;
    if (monthly < UNLIMITED) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const used = await prisma.proposal.count({ where: { organizationId: ctx.orgId, createdAt: { gte: monthStart } } });
      if (used >= monthly) {
        return NextResponse.json({ error: `Your plan includes ${monthly} proposals a month. Upgrade for unlimited proposals.`, upgradeRequired: true }, { status: 403 });
      }
    }

    const body = await request.json();
    if (!body.leadId || !body.title?.trim()) {
      return NextResponse.json({ error: 'Lead and proposal title are required' }, { status: 400 });
    }
    // The lead must belong to the caller's workspace.
    const lead = await prisma.lead.findFirst({ where: { id: String(body.leadId), organizationId: ctx.orgId }, select: { id: true, assignedToId: true } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    let value = body.value === '' || body.value == null ? null : Number(body.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Proposal value must be a valid positive number' }, { status: 400 });
    }
    const status = ['draft', 'sent', 'accepted', 'rejected'].includes(body.status) ? body.status : 'draft';
    // With line items this is a quote: numbered, priced server-side and shareable with the client.
    let quote: Record<string, unknown> = {};
    if (body.items !== undefined) {
      try {
        const t = totalsFrom(body.items);
        value = t.total;
        quote = { items: t.items, subtotal: t.subtotal, vatTotal: t.vatTotal, number: docNumber('Q', await nextSequence(ctx.orgId, 'quote')), shareToken: newShareToken() };
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) return NextResponse.json({ error: 'Invalid "valid until" date.' }, { status: 400 });

    const proposal = await prisma.proposal.create({
      data: {
        organizationId: ctx.orgId,
        leadId: lead.id,
        title: String(body.title).trim(),
        description: body.description?.trim() || null,
        value,
        status,
        sentAt: status === 'sent' ? new Date() : null,
        validUntil,
        terms: body.terms ? String(body.terms).slice(0, 4000) : null,
        ...quote,
      },
      include: { lead: { select: LEAD_SELECT } },
    });
    await afterProposalStatusChange(proposal.id, proposal.status);
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error('Failed to create proposal:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
