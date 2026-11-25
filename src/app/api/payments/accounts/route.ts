import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { encryptSecret } from '@/lib/secretBox';
import { PLAN_QUOTAS, UNLIMITED, normalizePlan } from '@/lib/plans';
import { accessToken, newSecretToken } from '@/lib/mpesa';

export const runtime = 'nodejs';

const view = (a: any) => ({
  id: a.id,
  label: a.label,
  type: a.type,
  shortcode: a.shortcode,
  tillNumber: a.tillNumber,
  environment: a.environment,
  c2bRegisteredAt: a.c2bRegisteredAt,
  createdAt: a.createdAt,
});

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const accounts = await prisma.mpesaAccount.findMany({ where: { organizationId: ctx.orgId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ accounts: accounts.map(view) });
}

/** Connect a Paybill or Till. Credentials are checked with Safaricom before they are saved (encrypted). */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('mpesa_payments');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can connect M-Pesa.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const type = b.type === 'TILL' ? 'TILL' : 'PAYBILL';
  const environment = b.environment === 'production' ? 'production' : 'sandbox';
  const shortcode = String(b.shortcode || '').trim();
  const tillNumber = type === 'TILL' ? String(b.tillNumber || '').trim() : '';
  const consumerKey = String(b.consumerKey || '').trim();
  const consumerSecret = String(b.consumerSecret || '').trim();
  const passkey = String(b.passkey || '').trim();
  const label = String(b.label || '').trim() || `${type === 'TILL' ? 'Till' : 'Paybill'} ${tillNumber || shortcode}`;

  if (!/^\d{5,7}$/.test(shortcode)) return NextResponse.json({ error: type === 'TILL' ? 'Enter the store (head office) number for your Till: 5 to 7 digits.' : 'Enter your Paybill number: 5 to 7 digits.' }, { status: 400 });
  if (type === 'TILL' && !/^\d{5,8}$/.test(tillNumber)) return NextResponse.json({ error: 'Enter the Till number customers pay to.' }, { status: 400 });
  if (!consumerKey || !consumerSecret || !passkey) return NextResponse.json({ error: 'Consumer key, consumer secret and passkey are all required.' }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true, _count: { select: { mpesaAccounts: true } } } });
  const max = PLAN_QUOTAS[normalizePlan(org?.plan)].mpesaAccounts;
  if (max < UNLIMITED && (org?._count.mpesaAccounts || 0) >= max) {
    return NextResponse.json({ error: `Your plan includes ${max} M-Pesa ${max === 1 ? 'account' : 'accounts'}. Upgrade to connect more.`, upgradeRequired: true }, { status: 403 });
  }

  try {
    await accessToken({ environment, type, shortcode, tillNumber, consumerKey, consumerSecret, passkey });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not reach Safaricom with these credentials.' }, { status: 422 });
  }

  try {
    const account = await prisma.mpesaAccount.create({
      data: {
        organizationId: ctx.orgId,
        label: label.slice(0, 80),
        type,
        shortcode,
        tillNumber: tillNumber || null,
        environment,
        consumerKey: encryptSecret(consumerKey)!,
        consumerSecret: encryptSecret(consumerSecret)!,
        passkey: encryptSecret(passkey)!,
        callbackToken: newSecretToken(),
      },
    });
    return NextResponse.json({ account: view(account) }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'This shortcode is already connected.' }, { status: 409 });
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can disconnect M-Pesa.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id') || '';
  // Payments keep their history; their account link is cleared.
  const result = await prisma.mpesaAccount.deleteMany({ where: { id, organizationId: ctx.orgId } });
  if (!result.count) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
