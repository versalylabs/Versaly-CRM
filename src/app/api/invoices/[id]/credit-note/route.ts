import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { createSalesInvoice, totalsFrom } from '@/lib/documents';
import { round2, type LineItem } from '@/lib/quotes';

/**
 * Credit note against an invoice: { items?, reason? }. Without items it credits the whole invoice.
 * The credit counts toward settling the invoice; anything above the balance is money to refund the customer.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await blockIfFeatureMissing('invoicing');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can issue credit notes.' }, { status: 403 });

  const inv = await prisma.salesInvoice.findFirst({ where: { id: params.id, organizationId: ctx.orgId, kind: 'INVOICE' }, include: { creditNotes: true } });
  if (!inv) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  if (inv.status === 'DRAFT' || inv.status === 'VOID') return NextResponse.json({ error: 'Only sent invoices can be credited. Void or edit a draft instead.' }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  let t;
  try {
    t = totalsFrom(b.items ?? (inv.items as LineItem[]));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const alreadyCredited = inv.creditNotes.reduce((s, c) => s + c.total, 0);
  if (round2(alreadyCredited + t.total) > inv.total + 0.005) return NextResponse.json({ error: 'Credit notes cannot add up to more than the invoice total.' }, { status: 400 });

  const note = await createSalesInvoice({ organizationId: ctx.orgId, leadId: inv.leadId, items: t.items, kind: 'CREDIT_NOTE', originalId: inv.id, notes: b.reason ? String(b.reason).slice(0, 500) : `Credit for invoice ${inv.number}`, status: 'SENT', userId: ctx.userId });
  const settled = Math.min(t.total, Math.max(0, inv.total - inv.amountPaid));
  if (settled > 0) {
    const paidOff = inv.amountPaid + settled >= inv.total - 0.005;
    await prisma.salesInvoice.update({ where: { id: inv.id }, data: { amountPaid: { increment: settled }, ...(paidOff ? { status: 'PAID', paidAt: new Date() } : {}) } });
  }
  await logLeadActivity(prisma, inv.leadId, 'INVOICE', `Credit note ${note.number} issued for invoice ${inv.number} (KES ${note.total.toLocaleString('en-US')})`, { invoiceId: inv.id, creditNoteId: note.id });
  return NextResponse.json({ creditNote: note, refundDue: round2(t.total - settled) }, { status: 201 });
}
