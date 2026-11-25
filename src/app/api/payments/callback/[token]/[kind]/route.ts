import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseC2BConfirmation, parseStkCallback } from '@/lib/mpesa';
import { handleStkResult, recordC2BPayment } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

/**
 * Safaricom calls these URLs: /stk (prompt results), /validate and /confirm (payments made straight to the Paybill/Till).
 * Daraja does not sign callbacks, so the unguessable token in the URL identifies the workspace's account,
 * and STK results are only applied to prompts that account sent.
 * shortcut: no source-IP allow-list for Safaricom; add one (or confirm each result with an STK query) if a token ever leaks.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string; kind: string } }) {
  const account = await prisma.mpesaAccount.findUnique({ where: { callbackToken: params.token } });
  if (!account) return NextResponse.json({ ResultCode: 1, ResultDesc: 'Unknown account' }, { status: 404 });
  const body = await req.json().catch(() => null);

  try {
    if (params.kind === 'validate') return NextResponse.json(ACCEPTED);

    if (params.kind === 'stk') {
      const result = parseStkCallback(body);
      if (result) await handleStkResult(account.id, result);
      return NextResponse.json(ACCEPTED);
    }

    if (params.kind === 'confirm') {
      const payment = parseC2BConfirmation(body);
      const ours = [account.shortcode, account.tillNumber].filter(Boolean);
      if (payment && ours.includes(payment.shortcode)) await recordC2BPayment(account, payment);
      return NextResponse.json(ACCEPTED);
    }
  } catch (error) {
    console.error(`M-Pesa ${params.kind} callback failed`, error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Processing failed' }, { status: 500 }); // Safaricom retries
  }
  return NextResponse.json({ ResultCode: 1, ResultDesc: 'Unknown callback' }, { status: 404 });
}
