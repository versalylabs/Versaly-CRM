import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { registerC2BUrls, simulateC2B } from '@/lib/mpesa';
import { callbackUrl, credentials, ensurePaymentRef, publicBaseUrl } from '@/lib/payments';

export const runtime = 'nodejs';

/**
 * POST { action: 'register' }  tells Safaricom to send Paybill/Till payments to this workspace.
 * POST { action: 'simulate', amount, leadId? }  sandbox only: a test customer pays the shortcode.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await blockIfFeatureMissing('mpesa_reconciliation');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can change M-Pesa settings.' }, { status: 403 });

  const account = await prisma.mpesaAccount.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'register') {
    if (!publicBaseUrl().startsWith('https://') || /localhost|127\.0\.0\.1/.test(publicBaseUrl())) {
      return NextResponse.json({ error: 'Safaricom can only send payments to the live site (https). Do this step on your deployed workspace.' }, { status: 400 });
    }
    try {
      await registerC2BUrls(credentials(account), callbackUrl(account, 'confirm'), callbackUrl(account, 'validate'));
    } catch (e: any) {
      return NextResponse.json({ error: `Safaricom did not accept the registration: ${e.message}` }, { status: 502 });
    }
    const updated = await prisma.mpesaAccount.update({ where: { id: account.id }, data: { c2bRegisteredAt: new Date() } });
    return NextResponse.json({ success: true, c2bRegisteredAt: updated.c2bRegisteredAt });
  }

  if (b.action === 'simulate') {
    if (account.environment !== 'sandbox') return NextResponse.json({ error: 'Test payments only work on sandbox accounts.' }, { status: 400 });
    const amount = Math.round(Number(b.amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 150000) return NextResponse.json({ error: 'Enter an amount between 1 and 150,000.' }, { status: 400 });
    let ref = 'TEST';
    if (b.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: String(b.leadId), organizationId: ctx.orgId }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
      ref = await ensurePaymentRef(lead.id);
    }
    try {
      await simulateC2B(credentials(account), amount, ref);
    } catch (e: any) {
      return NextResponse.json({ error: `Sandbox rejected the test payment: ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ success: true, message: 'Test payment sent. It appears here once Safaricom calls back (live site only).' });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
