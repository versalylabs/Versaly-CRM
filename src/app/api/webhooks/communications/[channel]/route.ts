import { NextRequest } from 'next/server';
import { handleWebhookGet, handleWebhookPost } from '@/lib/inboundWebhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same hardened implementation as /api/inbox/webhook; the URL segment is only a channel hint.
export async function GET(req: NextRequest, { params }: { params: { channel: string } }) {
  return handleWebhookGet(req, params.channel);
}

export async function POST(req: NextRequest, { params }: { params: { channel: string } }) {
  return handleWebhookPost(req, params.channel);
}
