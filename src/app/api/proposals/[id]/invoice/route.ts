import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { createSalesInvoice } from '@/lib/documents';
import type { LineItem } from '@/lib/quotes';

/** Turns a quote into an invoice (one invoice per quote). Body: { dueDate?, send? } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await blockIfFeatureMissing('invoicing');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const quote = await prisma.proposal.findFirst({ where: { id: params.id, organizationId: ctx.orgId }, include: { invoice: true } });
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  if (quote.invoice) return NextResponse.json({ invoice: quote.invoice });
  if (!Array.isArray(quote.items) || !quote.items.length) return NextResponse.json({ error: 'Add line items to this quote before invoicing it.' }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const dueDate = b.dueDate ? new Date(b.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
  const invoice = await createSalesInvoice({
    organizationId: ctx.orgId,
    leadId: quote.leadId,
    items: quote.items as LineItem[],
    dueDate,
    notes: quote.terms,
    proposalId: quote.id,
    status: b.send ? 'SENT' : 'DRAFT',
    userId: ctx.userId,
  });
  await logLeadActivity(prisma, quote.leadId, 'INVOICE', `Invoice ${invoice.number} created from quote ${quote.number || ''}`.trim(), { invoiceId: invoice.id, total: invoice.total });
  return NextResponse.json({ invoice }, { status: 201 });
}
