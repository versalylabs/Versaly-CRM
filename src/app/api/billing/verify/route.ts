import { NextRequest, NextResponse } from 'next/server';
import { applyPaystackCharge, verifyTransaction } from '@/lib/billing';
import { appUrl } from '@/lib/accountTokens';

/**
 * Paystack sends the customer back here after paying (?reference=...). We confirm the payment
 * with Paystack server-to-server (never trusting the query string), record it, then return the
 * customer to the billing page. The webhook records the same payment if this step is missed.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('trxref') || '';
  const back = (status: string) => NextResponse.redirect(`${appUrl(req.nextUrl.origin)}/settings/billing?payment=${status}`);
  if (!reference) return back('missing');
  try {
    const invoice = await applyPaystackCharge(await verifyTransaction(reference));
    return back(invoice ? 'success' : 'failed');
  } catch (error) {
    console.error('Paystack verification failed', error);
    return back('pending');
  }
}
