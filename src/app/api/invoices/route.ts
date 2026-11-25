import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { createSalesInvoice, totalsFrom } from '@/lib/documents';
import { invoiceStatus } from '@/lib/quotes';

const LEAD = { select: { id: true, contactName: true, companyName: true, phone: true, email: true } } as const;

/** Invoices and credit notes, newest first (?leadId=). Status includes derived part-paid / overdue. */
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const leadId = req.nextUrl.searchParams.get('leadId');
  const rows = await prisma.salesInvoice.findMany({
    where: { organizationId: ctx.orgId, ...(leadId ? { leadId } : {}) },
    include: { lead: LEAD },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return NextResponse.json({ invoices: rows.map((r) => ({ ...r, displayStatus: invoiceStatus(r) })) });
}

/** New invoice without a quote: { leadId, items, dueDate?, notes?, send? } */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('invoicing');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const b = await req.json().catch(() => ({}));
  const lead = await prisma.lead.findFirst({ where: { id: String(b.leadId || ''), organizationId: ctx.orgId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: 'Choose the customer to invoice.' }, { status: 400 });
  let items;
  try {
    items = totalsFrom(b.items).items;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const dueDate = b.dueDate ? new Date(b.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });

  const invoice = await createSalesInvoice({ organizationId: ctx.orgId, leadId: lead.id, items, dueDate, notes: b.notes ? String(b.notes).slice(0, 4000) : null, status: b.send ? 'SENT' : 'DRAFT', userId: ctx.userId });
  await logLeadActivity(prisma, lead.id, 'INVOICE', `Invoice ${invoice.number} created (KES ${invoice.total.toLocaleString('en-US')})`, { invoiceId: invoice.id });
  return NextResponse.json({ invoice }, { status: 201 });
}
