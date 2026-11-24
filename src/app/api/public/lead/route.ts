import { NextRequest, NextResponse } from 'next/server';
import { captureLead } from '../../../../../lib/leadCapture';
import prisma from '../../../../../lib/prisma';

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
    // Embedded website forms identify their workspace by its public slug (?workspace=acme or body.workspace).
    const slug = String(req.nextUrl.searchParams.get('workspace') || body?.workspace || '').trim().toLowerCase();
    const org = slug ? await prisma.organization.findUnique({ where: { slug }, select: { id: true, suspendedAt: true } }) : null;
    if (!org || org.suspendedAt) return cors(req, NextResponse.json({ error: 'Unknown workspace. Check the form code you copied.' }, { status: 404 }));
    const result = await captureLead(body, { defaultSource: 'WEBSITE_FORM', channel: 'WEBSITE_FORM', organizationId: org.id });
    const response = result.ok
      ? NextResponse.json({ success: true, duplicate: result.duplicate, message: result.duplicate ? 'This contact is already in our CRM.' : 'Thanks. Your enquiry has been received.' }, { status: result.status })
      : NextResponse.json({ error: result.error }, { status: result.status });
    return cors(req, response);
  } catch (error) {
    console.error('Public lead form failed', error);
    return cors(req, NextResponse.json({ error: 'Unable to submit the form.' }, { status: 500 }));
  }
}
