import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { totalsFrom } from '@/lib/documents';
import { invoicePayLink, publicBaseUrl } from '@/lib/payments';
import { invoiceStatus } from '@/lib/quotes';

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const inv = await prisma.salesInvoice.findFirst({
    where: { id: params.id, organizationId: ctx.orgId },
    include: { lead: true, payments: { where: { status: 'PAID' }, orderBy: { paidAt: 'desc' } }, creditNotes: true, original: { select: { id: true, number: true } } },
  });
  if (!inv) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  return NextResponse.json({ invoice: { ...inv, displayStatus: invoiceStatus(inv), link: `${publicBaseUrl()}/i/${inv.shareToken}` } });
}

/**
 * { action: 'send' }      marks a draft as sent (the share link starts working)
 * { action: 'void' }      cancels an unpaid invoice that was not sent to eTIMS (use a credit note otherwise)
 * { action: 'pay-link' }  M-Pesa pay link for the balance
 * { items, dueDate, notes } edits a draft
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const inv = await prisma.salesInvoice.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
  if (!inv) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'send') {
    if (inv.status !== 'DRAFT') return NextResponse.json({ invoice: inv });
    const updated = await prisma.salesInvoice.update({ where: { id: inv.id }, data: { status: 'SENT', sentAt: new Date() } });
    await logLeadActivity(prisma, inv.leadId, 'INVOICE', `Invoice ${inv.number} sent`, { invoiceId: inv.id });
    return NextResponse.json({ invoice: updated });
  }
  if (b.action === 'void') {
    if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can void invoices.' }, { status: 403 });
    if (inv.etimsStatus === 'SUBMITTED') return NextResponse.json({ error: 'This invoice is registered with KRA. Issue a credit note instead of voiding it.' }, { status: 409 });
    if (inv.amountPaid > 0) return NextResponse.json({ error: 'This invoice has payments. Issue a credit note instead.' }, { status: 409 });
    const updated = await prisma.salesInvoice.update({ where: { id: inv.id }, data: { status: 'VOID' } });
    await logLeadActivity(prisma, inv.leadId, 'INVOICE', `Invoice ${inv.number} voided`, { invoiceId: inv.id });
    return NextResponse.json({ invoice: updated });
  }
  if (b.action === 'pay-link') {
    try {
      return NextResponse.json({ url: await invoicePayLink(inv) });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  if (inv.status !== 'DRAFT' || inv.etimsStatus === 'SUBMITTED') return NextResponse.json({ error: 'Only draft invoices can be edited.' }, { status: 409 });
  const data: any = {};
  if (b.items !== undefined) {
    try {
      const t = totalsFrom(b.items);
      Object.assign(data, { items: t.items, subtotal: t.subtotal, vatTotal: t.vatTotal, total: t.total });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  if (b.dueDate !== undefined) {
    data.dueDate = b.dueDate ? new Date(b.dueDate) : null;
    if (data.dueDate && Number.isNaN(data.dueDate.getTime())) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
  }
  if (b.notes !== undefined) data.notes = String(b.notes || '').slice(0, 4000) || null;
  return NextResponse.json({ invoice: await prisma.salesInvoice.update({ where: { id: inv.id }, data }) });
}
