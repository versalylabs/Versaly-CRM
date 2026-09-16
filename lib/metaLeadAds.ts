import crypto from 'crypto';

export type MetaLeadField = { name?: string; values?: string[] };

export function verifyMetaSignature(rawBody: string, signature: string | null, appSecret = process.env.META_APP_SECRET) {
  if (!appSecret) return false;
  if (!signature || !signature.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function mapMetaLeadFields(fields: MetaLeadField[]) {
  const data: Record<string, string> = {};
  for (const field of fields || []) {
    const name = String(field?.name || '').toLowerCase();
    const value = field?.values?.[0] || '';
    if (!value) continue;
    if (name === 'full_name' || name === 'name') data.contactName = value;
    else if (name === 'first_name') data.firstName = value;
    else if (name === 'last_name') data.lastName = value;
    else if (name === 'email') data.email = value;
    else if (name === 'phone_number' || name === 'phone') data.phone = value;
    else if (name === 'company_name') data.companyName = value;
    else if (name === 'job_title') data.jobTitle = value;
    else if (name === 'city' || name === 'location') data.location = value;
    else data[name] = value;
  }
  return { ...data, source: 'META', externalSource: 'META_LEAD_ADS' };
}

export async function fetchMetaLead(leadgenId: string) {
  const token = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN is not configured.');
  const version = process.env.META_GRAPH_API_VERSION || 'v23.0';
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}?fields=id,created_time,field_data,ad_id,form_id&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Meta Graph API request failed (${response.status}).`);
  return payload;
}
