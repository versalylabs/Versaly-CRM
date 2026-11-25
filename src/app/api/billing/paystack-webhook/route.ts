import { NextRequest, NextResponse } from 'next/server';
import { applyPaystackCharge, verifyPaystackSignature } from '@/lib/billing';

export const runtime = 'nodejs';

/** Paystack webhook (set its URL in the Paystack dashboard). Only signed charge.success events are applied. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (event?.event === 'charge.success') {
    try {
      await applyPaystackCharge(event.data);
    } catch (error) {
      console.error('Paystack webhook processing failed', error);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 }); // Paystack retries
    }
  }
  return NextResponse.json({ received: true });
}
