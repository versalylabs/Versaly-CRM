import { NextRequest, NextResponse } from 'next/server';
import { captureLead } from '../../../../../lib/leadCapture';

function cors(req: NextRequest, response: NextResponse) {
  const allowed = process.env.LEAD_CAPTURE_ALLOWED_ORIGIN || '*';
  const origin = req.headers.get('origin') || '';
  response.headers.set('Access-Control-Allow-Origin', allowed === '*' ? '*' : (origin === allowed ? allowed : allowed));
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS(req: NextRequest) { return cors(req, new NextResponse(null, { status: 204 })); }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await captureLead(body, { defaultSource: 'WEBSITE_FORM', channel: 'WEBSITE_FORM' });
    const response = result.ok
      ? NextResponse.json({ success: true, duplicate: result.duplicate, message: result.duplicate ? 'This contact is already in our CRM.' : 'Thanks. Your enquiry has been received.' }, { status: result.status })
      : NextResponse.json({ error: result.error }, { status: result.status });
    return cors(req, response);
  } catch (error) {
    console.error('Public lead form failed', error);
    return cors(req, NextResponse.json({ error: 'Unable to submit the form.' }, { status: 500 }));
  }
}
