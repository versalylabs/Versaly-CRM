import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { submitToEtims } from '@/lib/etims';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Transmit an invoice or credit note to KRA eTIMS. Safe to retry after a failure. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await blockIfFeatureMissing('invoicing');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const inv = await prisma.salesInvoice.findFirst({ where: { id: params.id, organizationId: ctx.orgId }, include: { original: true } });
  if (!inv) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  if (inv.status === 'DRAFT' || inv.status === 'VOID') return NextResponse.json({ error: 'Send the invoice before transmitting it to KRA.' }, { status: 409 });
  if (inv.kind === 'CREDIT_NOTE' && inv.original?.etimsStatus !== 'SUBMITTED') return NextResponse.json({ error: 'Transmit the original invoice to KRA first.' }, { status: 409 });
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } });
  try {
    const updated = await submitToEtims(inv.id, user?.name || user?.email || 'VersalyLabs user');
    return NextResponse.json({ invoice: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'KRA eTIMS did not accept the invoice.' }, { status: 502 });
  }
}
