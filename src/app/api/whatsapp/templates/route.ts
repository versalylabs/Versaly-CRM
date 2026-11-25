import { NextRequest, NextResponse } from 'next/server';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { createTemplate, listTemplates, templateParamCount } from '@/lib/whatsapp';

export const runtime = 'nodejs';

/** WhatsApp message templates from Meta (live, so approval status is always current). */
export async function GET() {
  const gate = await blockIfFeatureMissing('whatsapp');
  if (gate) return gate;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    return NextResponse.json({ templates: await listTemplates(ctx.orgId) });
  } catch (e: any) {
    return NextResponse.json({ templates: [], error: e.message }, { status: 200 });
  }
}

/** Submit a new template for Meta's review: { name, category, language, body, examples[] } */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('whatsapp');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can create templates.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 512);
  const category = ['MARKETING', 'UTILITY'].includes(String(b.category).toUpperCase()) ? String(b.category).toUpperCase() : 'UTILITY';
  const language = /^[a-z]{2}(_[A-Z]{2})?$/.test(String(b.language)) ? String(b.language) : 'en';
  const body = String(b.body || '').trim();
  const examples = Array.isArray(b.examples) ? b.examples.map((x: unknown) => String(x).trim()) : [];
  if (!name) return NextResponse.json({ error: 'Give the template a name, e.g. payment_reminder.' }, { status: 400 });
  if (!body || body.length > 1024) return NextResponse.json({ error: 'Write the message (up to 1,024 characters).' }, { status: 400 });
  const params = templateParamCount(body);
  if (examples.length < params || examples.slice(0, params).some((x: string) => !x)) {
    return NextResponse.json({ error: `Meta needs an example for each of the ${params} placeholders ({{1}}, {{2}}...).` }, { status: 400 });
  }
  try {
    await createTemplate(ctx.orgId, { name, category, language, body, examples: examples.slice(0, params) });
    return NextResponse.json({ success: true, message: 'Submitted to Meta for review. Approval usually takes minutes to a day.' }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
