import { blockIfFeatureMissing } from '../../../../../../lib/subscription';
import { blockIfReadOnly } from '../../../../../../lib/subscription';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { encryptSecret, generateWebhookSecret } from '@/lib/secretBox';
import { guessMailSettings, type MailServerSettings } from '@/lib/emailAccount';
import { publicHostError } from '@/lib/safeUrl';
import { testMailboxConnection, syncWorkspaceMailbox } from '@/lib/emailSync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET: server settings guessed for an address (so the form can pre-fill them). */
export async function GET(req: NextRequest) {
  const planGate = await blockIfFeatureMissing('email_inbox');
  if (planGate) return planGate;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const address = (req.nextUrl.searchParams.get('address') || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(address)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  return NextResponse.json({ settings: guessMailSettings(address) });
}

/** POST: connect (or replace) the workspace mailbox after verifying it works. */
export async function POST(req: NextRequest) {
  const planGate = await blockIfFeatureMissing('email_inbox');
  if (planGate) return planGate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) {
    return NextResponse.json({ error: 'Only workspace admins and managers can connect email.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const address = String(body.address || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.displayName || '').trim();

  if (!/^\S+@\S+\.\S+$/.test(address)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!password) return NextResponse.json({ error: 'Enter the app password for this email account.' }, { status: 400 });

  const guessed = guessMailSettings(address);
  const adv = body.settings && typeof body.settings === 'object' ? body.settings : {};
  const settings: MailServerSettings = {
    imapHost: String(adv.imapHost || guessed.imapHost).trim(),
    imapPort: Number(adv.imapPort) || guessed.imapPort,
    imapSecure: adv.imapSecure === undefined ? guessed.imapSecure : Boolean(adv.imapSecure),
    smtpHost: String(adv.smtpHost || guessed.smtpHost).trim(),
    smtpPort: Number(adv.smtpPort) || guessed.smtpPort,
    smtpSecure: adv.smtpSecure === undefined ? guessed.smtpSecure : Boolean(adv.smtpSecure),
    username: adv.username ? String(adv.username).trim() : undefined,
  };

  for (const host of [settings.imapHost, settings.smtpHost]) {
    const hostError = await publicHostError(host);
    if (hostError) return NextResponse.json({ error: `${host}: ${hostError}` }, { status: 400 });
  }
  const problem = await testMailboxConnection(address, password, settings);
  if (problem) return NextResponse.json({ error: problem }, { status: 422 });

  // One mailbox per workspace for now: replace any existing email connection.
  await prisma.connectedChannelAccount.deleteMany({ where: { organizationId: ctx.orgId, channel: 'EMAIL' } });
  const account = await prisma.connectedChannelAccount.create({
    data: {
      organizationId: ctx.orgId,
      channel: 'EMAIL',
      accountName: displayName || address,
      accountHandle: address,
      accessToken: encryptSecret(password),
      webhookSecret: generateWebhookSecret(),
      status: 'CONNECTED',
      lastSyncAt: null,
      metadata: { ...settings, lastUid: 0 } as any,
    },
  });

  // First import so the inbox is not empty after connecting.
  const sync = await syncWorkspaceMailbox(ctx.orgId, { minIntervalMs: 0 });
  return NextResponse.json({ success: true, accountId: account.id, address, imported: sync.imported, syncError: sync.error || null }, { status: 201 });
}
