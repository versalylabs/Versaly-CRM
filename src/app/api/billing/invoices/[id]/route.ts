import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { PLANS, normalizePlan } from '@/lib/plans';

/** One invoice of the caller's own workspace, for the printable receipt. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.orgId },
    include: { organization: { select: { name: true } } },
  });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  return NextResponse.json({
    number: invoice.number,
    reference: invoice.reference,
    workspace: invoice.organization.name,
    plan: PLANS[normalizePlan(invoice.plan)].name,
    interval: invoice.interval,
    amountKes: invoice.amountKes,
    status: invoice.status,
    channel: invoice.channel,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    paidAt: invoice.paidAt || invoice.createdAt,
  });
}
