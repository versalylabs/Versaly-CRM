import { NextRequest, NextResponse } from 'next/server';
import { captureLead } from '../../../../../lib/leadCapture';
import { getPlatformOrgId } from '../../../../../lib/tenant';

export async function POST(req: NextRequest) {
  const expected = process.env.LEAD_CAPTURE_API_KEY;
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected) return NextResponse.json({ error: 'Lead capture integration is not configured. Set LEAD_CAPTURE_API_KEY.' }, { status: 503 });
  if (!key || key !== expected) return NextResponse.json({ error: 'Invalid integration API key.' }, { status: 401 });
  try {
    const body = await req.json();
    // LEAD_CAPTURE_API_KEY is a platform-level key, so its leads belong to the VersalyLabs workspace.
    // Customer workspaces use their own developer API keys (/api/v1/leads).
    const organizationId = await getPlatformOrgId();
    if (!organizationId) return NextResponse.json({ error: 'Platform workspace not found. Set PLATFORM_ORG_SLUG.' }, { status: 503 });
    const result = await captureLead(body, { organizationId, defaultSource: body?.leadSource || body?.source || 'OTHER', channel: String(body?.channel || body?.source || 'WEBHOOK') });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const resAny = result as any;
    return NextResponse.json({ success: true, duplicate: resAny.duplicate, welcomeEmailSent: resAny.welcomeEmailSent || false, lead: resAny.lead, task: resAny.task || null }, { status: result.status });
  } catch (error) {
    console.error('Lead integration failed', error);
    return NextResponse.json({ error: 'Unable to process incoming lead.' }, { status: 500 });
  }
}
