import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { encryptSecret, generateWebhookSecret } from '@/lib/secretBox';
import { completeEmbeddedSignup, embeddedSignupConfigured } from '@/lib/whatsapp';

export const runtime = 'nodejs';

/** Whether "Connect with Facebook" is available, and the public IDs the browser needs to open Meta's flow. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const enabled = embeddedSignupConfigured() && Boolean(process.env.META_ES_CONFIG_ID);
  return NextResponse.json({ enabled, appId: enabled ? process.env.META_APP_ID : null, configId: enabled ? process.env.META_ES_CONFIG_ID : null });
}

/** Finishes Embedded Signup: { code, wabaId, phoneNumberId } from Meta's popup. */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('whatsapp');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can connect WhatsApp.' }, { status: 403 });
  if (!embeddedSignupConfigured()) return NextResponse.json({ error: 'One-click WhatsApp connection is not switched on yet.' }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const code = String(b.code || '');
  const wabaId = String(b.wabaId || '').replace(/\D/g, '');
  const phoneNumberId = String(b.phoneNumberId || '').replace(/\D/g, '');
  if (!code || !wabaId || !phoneNumberId) return NextResponse.json({ error: 'Meta did not return the WhatsApp account details. Please try again.' }, { status: 400 });

  // The same number must not end up connected to two workspaces.
  const taken = await prisma.connectedChannelAccount.findFirst({ where: { channel: 'WHATSAPP', externalAccountId: phoneNumberId, NOT: { organizationId: ctx.orgId } } });
  if (taken) return NextResponse.json({ error: 'This WhatsApp number is already connected to another workspace.' }, { status: 409 });

  try {
    const r = await completeEmbeddedSignup(code, wabaId, phoneNumberId);
    await prisma.connectedChannelAccount.deleteMany({ where: { organizationId: ctx.orgId, channel: 'WHATSAPP' } });
    await prisma.connectedChannelAccount.create({
      data: {
        organizationId: ctx.orgId,
        channel: 'WHATSAPP',
        accountName: r.verifiedName,
        accountHandle: r.displayNumber,
        externalAccountId: phoneNumberId,
        accessToken: encryptSecret(r.token),
        webhookSecret: generateWebhookSecret(),
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        metadata: { wabaId, embeddedSignup: true, registrationPin: encryptSecret(r.pin) } as any,
      },
    });
    return NextResponse.json({ success: true, number: r.displayNumber, name: r.verifiedName }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not finish connecting WhatsApp.' }, { status: 502 });
  }
}
