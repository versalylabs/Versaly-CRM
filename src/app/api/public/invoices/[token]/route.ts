import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { invoiceDocument } from '@/lib/documents';
import { invoicePayLink } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const load = (token: string) => prisma.salesInvoice.findUnique({ where: { shareToken: token }, include: { organization: true, lead: true, original: true } });

/** Public: the invoice or credit note as the customer sees it (with the eTIMS QR once transmitted). */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const inv = await load(params.token);
  if (!inv || inv.status === 'DRAFT') return NextResponse.json({ error: 'This invoice link is not valid.' }, { status: 404 });
  const hasMpesa = Boolean(await prisma.mpesaAccount.findFirst({ where: { organizationId: inv.organizationId }, select: { id: true } }));
  return NextResponse.json({ ...(await invoiceDocument(inv)), canPay: hasMpesa && inv.kind === 'INVOICE' && inv.status !== 'VOID' && inv.amountPaid < inv.total });
}

/** Public: "Pay with M-Pesa" returns the pay link for the balance. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limit = await checkRateLimit(`invpay:${params.token}:${clientIp(req.headers)}`, 10, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again shortly.' }, { status: 429 });
  const inv = await load(params.token);
  if (!inv || inv.status === 'DRAFT' || inv.status === 'VOID' || inv.kind !== 'INVOICE') return NextResponse.json({ error: 'This invoice cannot be paid online.' }, { status: 404 });
  try {
    return NextResponse.json({ url: await invoicePayLink(inv) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
