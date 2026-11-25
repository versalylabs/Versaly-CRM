import { NextRequest, NextResponse } from 'next/server';
import { blockIfFeatureMissing } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { paystackConfigured, startSmsCreditCheckout } from '@/lib/billing';
import { appUrl } from '@/lib/accountTokens';

/** Starts a Paystack checkout for an SMS credit pack: { credits } */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('sms');
  if (gate) return gate;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!paystackConfigured()) return NextResponse.json({ error: 'Online payments are not set up yet. Please contact VersalyLabs support.' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  try {
    const url = await startSmsCreditCheckout({
      organizationId: ctx.orgId,
      email: ctx.email || '',
      credits: Number(b.credits),
      callbackUrl: `${appUrl(req.nextUrl.origin)}/api/billing/verify?return=messaging`,
    });
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
