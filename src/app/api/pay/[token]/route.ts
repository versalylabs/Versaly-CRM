import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { mpesaPhone } from '@/lib/mpesa';
import { refreshPendingPayment, sendStkPrompt } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETRYABLE = ['REQUESTED', 'FAILED', 'CANCELLED'];

async function load(token: string) {
  return prisma.payment.findUnique({
    where: { linkToken: token },
    include: { organization: { select: { name: true } }, mpesaAccount: { select: { id: true, type: true, shortcode: true, tillNumber: true } } },
  });
}

/** Public: what the customer is paying, and its current status. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const found = await load(params.token);
  if (!found) return NextResponse.json({ error: 'This payment link is not valid any more.' }, { status: 404 });
  const p = found.status === 'PENDING' ? await refreshPendingPayment(found.id) : found;
  return NextResponse.json({
    business: found.organization.name,
    amount: found.amount,
    description: found.description,
    status: p?.status || found.status,
    resultDesc: p?.resultDesc || null,
    receipt: p?.status === 'PAID' ? p.mpesaReceipt : null,
    paybill: found.mpesaAccount?.type === 'PAYBILL' ? { number: found.mpesaAccount.shortcode, account: found.accountRef } : null,
    till: found.mpesaAccount?.type === 'TILL' ? found.mpesaAccount.tillNumber : null,
  });
}

/** Public: the customer enters their number and gets the M-Pesa prompt. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = clientIp(req.headers);
  const limit = await checkRateLimit(`pay:${params.token}:${ip}`, 5, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });

  const payment = await load(params.token);
  if (!payment || !payment.mpesaAccount) return NextResponse.json({ error: 'This payment link is not valid any more.' }, { status: 404 });
  if (payment.status === 'PAID') return NextResponse.json({ error: 'This has already been paid. Thank you!' }, { status: 409 });
  if (payment.status === 'PENDING' && Date.now() - payment.updatedAt.getTime() < 60_000) {
    return NextResponse.json({ error: 'A prompt was just sent. Check your phone, or try again in a minute.' }, { status: 409 });
  }
  if (!RETRYABLE.includes(payment.status) && payment.status !== 'PENDING') return NextResponse.json({ error: 'This payment link is closed.' }, { status: 410 });

  const body = await req.json().catch(() => ({}));
  const phone = mpesaPhone(body.phone);
  if (!phone) return NextResponse.json({ error: 'Enter your Safaricom number, e.g. 0712 345 678.' }, { status: 400 });

  try {
    const sent = await sendStkPrompt(payment.id, phone);
    return NextResponse.json({ status: sent.status });
  } catch (e: any) {
    console.error('Payment link STK failed', e);
    return NextResponse.json({ error: 'M-Pesa could not send the prompt right now. Please try again, or pay using the Paybill/Till details below.' }, { status: 502 });
  }
}
