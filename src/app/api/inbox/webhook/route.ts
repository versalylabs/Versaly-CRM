import { NextRequest } from 'next/server';
import { handleWebhookGet, handleWebhookPost } from '@/lib/inboundWebhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Shared, hardened implementation: see lib/inboundWebhooks.ts
export async function GET(req: NextRequest) {
  return handleWebhookGet(req);
}

export async function POST(req: NextRequest) {
  return handleWebhookPost(req);
}
