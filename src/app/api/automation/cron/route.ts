import { NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '../../../../../lib/env';
import { runInactiveLeadWorkflows } from '../../../../../lib/workflows';
import { syncAllMailboxes } from '../../../../../lib/emailSync';
import { runBillingCycle } from '../../../../../lib/billing';
import { runPaymentReminders } from '../../../../../lib/payments';
import { checkSlaBreaches } from '../../../../../lib/inbox';
import prisma from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function suppliedSecret(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return request.headers.get('x-cron-secret')?.trim() || null;
}

async function handle(request: NextRequest) {
  const expected = getCronSecret();
  if (!expected) {
    return NextResponse.json({ error: 'Automation scheduler is not configured.' }, { status: 503 });
  }
  if (suppliedSecret(request) !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runInactiveLeadWorkflows();
    const mail = await syncAllMailboxes().catch((e) => ({ accounts: 0, imported: 0, error: String(e?.message || e) }));
    const billing = await runBillingCycle(new Date(), process.env.NEXTAUTH_URL || request.nextUrl.origin).catch((e) => ({ error: String(e?.message || e) }));
    const reminders = await runPaymentReminders().catch((e) => ({ error: String(e?.message || e) }));
    const slaOrgs = await prisma.organization.findMany({ where: { inboxSlaMinutes: { not: null } }, select: { id: true } });
    for (const o of slaOrgs) await checkSlaBreaches(o.id).catch(() => undefined);
    return NextResponse.json({ ok: true, ...result, mail, billing, reminders, executedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Scheduled automation run failed', error);
    return NextResponse.json({ error: 'Scheduled automation run failed.' }, { status: 500 });
  }
}

// Vercel Cron invokes GET with "Authorization: Bearer $CRON_SECRET"; external schedulers may use POST.
export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
