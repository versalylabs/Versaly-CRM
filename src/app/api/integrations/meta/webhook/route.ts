import { NextRequest, NextResponse } from 'next/server';
import { captureLead } from '../../../../../../lib/leadCapture';
import { fetchMetaLead, mapMetaLeadFields, verifyMetaSignature } from '../../../../../../lib/metaLeadAds';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const mode = search.get('hub.mode');
  const token = search.get('hub.verify_token');
  const challenge = search.get('hub.challenge');
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!process.env.META_APP_SECRET) return NextResponse.json({ error: 'META_APP_SECRET is not configured.' }, { status: 503 });
  if (!verifyMetaSignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid Meta webhook signature.' }, { status: 401 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }); }
  if (payload?.object !== 'page') return NextResponse.json({ received: true, ignored: true });

  const events: any[] = [];
  for (const entry of payload.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      if (change?.field !== 'leadgen' || !value?.leadgen_id) continue;
      events.push({ leadgenId: String(value.leadgen_id), pageId: String(value.page_id || entry.id || ''), formId: value.form_id ? String(value.form_id) : null });
    }
  }

  // Acknowledge after processing so failures are visible to Meta and can be retried.
  const results: any[] = [];
  try {
    for (const event of events) {
      const metaLead = await fetchMetaLead(event.leadgenId);
      const input = mapMetaLeadFields(metaLead.field_data || []);
      const result = await captureLead({ ...input, notes: `Meta Lead Ad ID: ${event.leadgenId}\nForm ID: ${event.formId || 'Unknown'}` }, { defaultSource: 'SOCIAL_MEDIA', channel: 'META_LEAD_ADS' });
      if (!result.ok) throw new Error(result.error || 'Unable to capture Meta lead.');
      results.push({ leadgenId: event.leadgenId, duplicate: result.duplicate, leadId: result.lead?.id || null });
    }
    return NextResponse.json({ received: true, processed: results.length, results });
  } catch (error: any) {
    console.error('Meta Lead Ads webhook failed', error);
    return NextResponse.json({ error: error?.message || 'Unable to process Meta lead webhook.' }, { status: 500 });
  }
}
