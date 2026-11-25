import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { PLAN_QUOTAS, UNLIMITED, normalizePlan } from '@/lib/plans';
import { logLeadActivity } from '@/lib/automation';
import { mpesaPhone, newSecretToken } from '@/lib/mpesa';
import { ensurePaymentRef, getCollectionAccount, payLinkUrl, sendStkPrompt } from '@/lib/payments';
import { toCsv } from '@/lib/csv';

export const runtime = 'nodejs';

const LEAD = { select: { id: true, contactName: true, companyName: true, phone: true } } as const;

/** Transactions. ?view=unmatched | ?leadId= | ?status= | ?format=csv */
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const q = req.nextUrl.searchParams;
  const where: any = { organizationId: ctx.orgId };
  if (q.get('view') === 'unmatched') Object.assign(where, { status: 'PAID', leadId: null });
  if (q.get('leadId')) where.leadId = q.get('leadId');
  if (q.get('status')) where.status = q.get('status');
  const payments = await prisma.payment.findMany({ where, include: { lead: LEAD }, orderBy: { createdAt: 'desc' }, take: q.get('format') === 'csv' ? 10000 : 300 });

  if (q.get('format') === 'csv') {
    const header = ['Date', 'Status', 'Amount (KES)', 'M-Pesa receipt', 'Customer', 'Company', 'Phone', 'Payer name', 'Account ref', 'Source', 'Description'];
    const rows = payments.map((p) => [
      (p.paidAt || p.createdAt).toISOString(), p.status, p.amount, p.mpesaReceipt, p.lead?.contactName, p.lead?.companyName,
      p.phone, p.payerName, p.accountRef, p.source, p.description,
    ]);
    return new NextResponse(toCsv(header, rows), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="mpesa-payments-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  }
  return NextResponse.json({ payments });
}

/** Request a payment from a customer: { leadId, amount, method: 'stk' | 'link', phone?, description?, accountId? } */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('mpesa_payments');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const b = await req.json().catch(() => ({}));
  const amount = Math.round(Number(b.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 250000) return NextResponse.json({ error: 'Enter an amount between KES 1 and 250,000 (the M-Pesa limit per transaction).' }, { status: 400 });
  const method = b.method === 'link' ? 'link' : 'stk';
  const lead = await prisma.lead.findFirst({ where: { id: String(b.leadId || ''), organizationId: ctx.orgId }, select: { id: true, phone: true, contactName: true } });
  if (!lead) return NextResponse.json({ error: 'Choose a customer for this payment.' }, { status: 400 });
  const phone = mpesaPhone(b.phone || lead.phone);
  if (method === 'stk' && !phone) return NextResponse.json({ error: 'Enter a Safaricom number such as 0712 345 678.' }, { status: 400 });

  const account = await getCollectionAccount(ctx.orgId, b.accountId);
  if (!account) return NextResponse.json({ error: 'Connect your M-Pesa Paybill or Till first (Payments → Settings).', needsSetup: true }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true } });
  const monthly = PLAN_QUOTAS[normalizePlan(org?.plan)].mpesaRequestsPerMonth;
  if (monthly < UNLIMITED) {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const used = await prisma.payment.count({ where: { organizationId: ctx.orgId, source: { in: ['STK', 'LINK'] }, createdById: { not: null }, createdAt: { gte: start } } });
    if (used >= monthly) return NextResponse.json({ error: `Your plan includes ${monthly} payment requests a month. Upgrade for unlimited requests.`, upgradeRequired: true }, { status: 403 });
  }

  const description = String(b.description || '').trim().slice(0, 60) || null;
  const payment = await prisma.payment.create({
    data: {
      organizationId: ctx.orgId,
      mpesaAccountId: account.id,
      leadId: lead.id,
      source: method === 'link' ? 'LINK' : 'STK',
      status: 'REQUESTED',
      amount,
      phone,
      description,
      accountRef: await ensurePaymentRef(lead.id),
      linkToken: method === 'link' ? newSecretToken() : null,
      createdById: ctx.userId,
    },
  });

  if (method === 'link') {
    await logLeadActivity(prisma, lead.id, 'PAYMENT', `M-Pesa payment link created for KES ${amount.toLocaleString('en-US')}`, { paymentId: payment.id });
    return NextResponse.json({ payment, link: payLinkUrl(payment.linkToken!) }, { status: 201 });
  }

  try {
    const sent = await sendStkPrompt(payment.id, phone!);
    await logLeadActivity(prisma, lead.id, 'PAYMENT', `M-Pesa prompt sent to ${phone} for KES ${amount.toLocaleString('en-US')}`, { paymentId: payment.id });
    return NextResponse.json({ payment: sent }, { status: 201 });
  } catch (e: any) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', resultDesc: String(e.message || 'Request failed').slice(0, 200) } });
    return NextResponse.json({ error: `Safaricom did not accept the request: ${e.message}` }, { status: 502 });
  }
}
