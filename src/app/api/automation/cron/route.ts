import { NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '../../../../../lib/env';
import { runInactiveLeadWorkflows } from '../../../../../lib/workflows';

export const dynamic = 'force-dynamic';

function suppliedSecret(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return request.headers.get('x-cron-secret')?.trim() || null;
}

export async function POST(request: NextRequest) {
  const expected = getCronSecret();
  if (!expected) {
    return NextResponse.json({ error: 'Automation scheduler is not configured.' }, { status: 503 });
  }
  if (suppliedSecret(request) !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runInactiveLeadWorkflows();
    return NextResponse.json({ ok: true, ...result, executedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Scheduled automation run failed', error);
    return NextResponse.json({ error: 'Scheduled automation run failed.' }, { status: 500 });
  }
}
