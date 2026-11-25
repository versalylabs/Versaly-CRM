import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { fetchMedia } from '@/lib/whatsapp';

export const runtime = 'nodejs';

/** Streams a photo, document or voice note a customer sent on WhatsApp (by our message ID, workspace-scoped). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const msg = await prisma.conversationMessage.findFirst({ where: { id: params.id, conversation: { organizationId: ctx.orgId } }, select: { metadata: true } });
  const media = (msg?.metadata as any)?.media;
  if (!media?.id) return NextResponse.json({ error: 'No attachment.' }, { status: 404 });
  try {
    const file = await fetchMedia(ctx.orgId, String(media.id));
    const filename = String(media.filename || `whatsapp-${media.type || 'file'}`).replace(/[^\w.\- ]+/g, '_');
    return new NextResponse(file.body as any, {
      headers: {
        'Content-Type': file.mime,
        // Only plain photos display inline; anything else (SVG, HTML, PDF...) downloads, so it can't run on our domain.
        'Content-Disposition': `${/^image\/(jpeg|png|webp|gif)$/.test(file.mime) ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Security-Policy': "default-src 'none'",
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Attachment unavailable.' }, { status: 410 });
  }
}
