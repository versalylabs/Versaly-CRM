import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { afterPaymentMatched, refreshPendingPayment } from '@/lib/payments';

export const runtime = 'nodejs';

/** Payment status. Pending prompts are re-checked with Safaricom, so the page can poll this. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const found = await prisma.payment.findFirst({ where: { id: params.id, organizationId: ctx.orgId }, select: { id: true } });
  if (!found) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  const payment = await refreshPendingPayment(found.id);
  return NextResponse.json({ payment });
}

/** { leadId } assigns an unmatched payment to a customer; { action: 'cancel' } withdraws an unpaid request. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const payment = await prisma.payment.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'cancel') {
    if (!['REQUESTED', 'PENDING'].includes(payment.status)) return NextResponse.json({ error: 'Only unpaid requests can be cancelled.' }, { status: 400 });
    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED', resultDesc: 'Cancelled by your team', linkToken: null } });
    return NextResponse.json({ payment: updated });
  }

  if (b.leadId) {
    if (payment.status !== 'PAID' || payment.leadId) return NextResponse.json({ error: 'Only unmatched payments can be assigned.' }, { status: 400 });
    const lead = await prisma.lead.findFirst({ where: { id: String(b.leadId), organizationId: ctx.orgId }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    // Conditional update so two people assigning at once cannot apply it twice.
    const claimed = await prisma.payment.updateMany({ where: { id: payment.id, leadId: null }, data: { leadId: lead.id, matchedBy: 'MANUAL' } });
    if (claimed.count) await afterPaymentMatched(payment.id);
    return NextResponse.json({ payment: await prisma.payment.findUnique({ where: { id: payment.id } }) });
  }

  return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
}
