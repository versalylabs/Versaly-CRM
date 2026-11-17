import { NextResponse } from 'next/server';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { syncWorkspaceMailbox } from '@/lib/emailSync';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Pulls new email for the caller's workspace (throttled). Called by the inbox while it is open. */
export async function POST() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    const result = await syncWorkspaceMailbox(ctx.orgId);
    return NextResponse.json(result);
  } catch (e) {
    console.error('Inbox sync failed:', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
