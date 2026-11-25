import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { afterProposalStatusChange, quoteDocument } from '@/lib/documents';

export const dynamic = 'force-dynamic';

const load = (token: string) => prisma.proposal.findUnique({ where: { shareToken: token }, include: { organization: true, lead: true } });

/** Public: the quote as the client sees it. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const p = await load(params.token);
  if (!p?.organization || !p.lead) return NextResponse.json({ error: 'This quote link is not valid.' }, { status: 404 });
  if (p.status === 'draft') return NextResponse.json({ error: 'This quote has not been sent yet.' }, { status: 404 });
  return NextResponse.json(quoteDocument(p));
}

/** Public: the client accepts ({ action: 'accept', name }) or declines ({ action: 'decline' }). */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limit = await checkRateLimit(`quote:${params.token}:${clientIp(req.headers)}`, 10, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again shortly.' }, { status: 429 });
  const p = await load(params.token);
  if (!p?.lead || p.status === 'draft') return NextResponse.json({ error: 'This quote link is not valid.' }, { status: 404 });
  if (p.acceptedAt || p.status === 'rejected') return NextResponse.json({ error: 'This quote has already been answered.' }, { status: 409 });
  if (p.validUntil && p.validUntil.getTime() < Date.now() - 86_400_000) return NextResponse.json({ error: 'This quote has expired. Please ask for an updated one.' }, { status: 410 });

  const b = await req.json().catch(() => ({}));
  if (b.action === 'accept') {
    const name = String(b.name || '').trim().slice(0, 120);
    if (name.length < 2) return NextResponse.json({ error: 'Type your full name to accept.' }, { status: 400 });
    // Conditional update so a double click cannot accept twice.
    const done = await prisma.proposal.updateMany({ where: { id: p.id, acceptedAt: null, status: { not: 'rejected' } }, data: { status: 'accepted', acceptedName: name, acceptedAt: new Date(), respondedAt: new Date() } });
    if (done.count) await afterProposalStatusChange(p.id, 'accepted', name);
    return NextResponse.json({ success: true });
  }
  if (b.action === 'decline') {
    const done = await prisma.proposal.updateMany({ where: { id: p.id, acceptedAt: null, status: { not: 'rejected' } }, data: { status: 'rejected', respondedAt: new Date() } });
    if (done.count) await afterProposalStatusChange(p.id, 'rejected', 'the client');
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
