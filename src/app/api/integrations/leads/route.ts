import { NextRequest, NextResponse } from 'next/server';
import { captureLead } from '../../../../../lib/leadCapture';

export async function POST(req: NextRequest) {
  const expected = process.env.LEAD_CAPTURE_API_KEY;
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected) return NextResponse.json({ error: 'Lead capture integration is not configured. Set LEAD_CAPTURE_API_KEY.' }, { status: 503 });
  if (!key || key !== expected) return NextResponse.json({ error: 'Invalid integration API key.' }, { status: 401 });
  try {
    const body = await req.json();
    const result = await captureLead(body, { defaultSource: body?.leadSource || body?.source || 'OTHER', channel: String(body?.channel || body?.source || 'WEBHOOK') });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const resAny = result as any;
    return NextResponse.json({ success: true, duplicate: resAny.duplicate, welcomeEmailSent: resAny.welcomeEmailSent || false, lead: resAny.lead, task: resAny.task || null }, { status: result.status });
  } catch (error) {
    console.error('Lead integration failed', error);
    return NextResponse.json({ error: 'Unable to process incoming lead.' }, { status: 500 });
  }
}
