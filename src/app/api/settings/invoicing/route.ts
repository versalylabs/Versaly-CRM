import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { initialiseDevice } from '@/lib/etims';

export const runtime = 'nodejs';

const FIELDS = { legalName: true, kraPin: true, businessAddress: true, invoiceFooter: true, etimsEnv: true, etimsBranchId: true, etimsDeviceSerial: true, etimsCmcKey: true, name: true } as const;

/** Business details printed on quotes and invoices, and the eTIMS connection status. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const o = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: FIELDS });
  if (!o) return unauthorized();
  const { etimsCmcKey, ...rest } = o;
  return NextResponse.json({ ...rest, etimsReady: Boolean(etimsCmcKey) });
}

export async function PATCH(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can change invoice settings.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const text = (v: unknown, max: number) => (v === undefined ? undefined : String(v || '').trim().slice(0, max) || null);
  const data: any = {
    legalName: text(b.legalName, 120),
    businessAddress: text(b.businessAddress, 300),
    invoiceFooter: text(b.invoiceFooter, 1000),
  };
  if (b.kraPin !== undefined) {
    const pin = String(b.kraPin || '').trim().toUpperCase();
    if (pin && !/^[AP]\d{9}[A-Z]$/.test(pin)) return NextResponse.json({ error: 'A KRA PIN looks like P051234567X.' }, { status: 400 });
    data.kraPin = pin || null;
  }
  if (b.etimsEnv !== undefined) data.etimsEnv = ['sandbox', 'production'].includes(b.etimsEnv) ? b.etimsEnv : null;
  if (b.etimsBranchId !== undefined) data.etimsBranchId = /^\d{2}$/.test(String(b.etimsBranchId)) ? String(b.etimsBranchId) : '00';
  if (b.etimsDeviceSerial !== undefined) data.etimsDeviceSerial = text(b.etimsDeviceSerial, 60);
  // Changing where eTIMS points means the old communication key and item codes no longer apply.
  const current = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { kraPin: true, etimsEnv: true, etimsBranchId: true, etimsDeviceSerial: true } });
  if (['kraPin', 'etimsEnv', 'etimsBranchId', 'etimsDeviceSerial'].some((k) => data[k] !== undefined && data[k] !== (current as any)?.[k])) {
    data.etimsCmcKey = null;
    data.etimsItems = Prisma.DbNull;
  }
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  await prisma.organization.update({ where: { id: ctx.orgId }, data });
  return NextResponse.json({ success: true });
}

/** Initialise the eTIMS device with KRA (once per KRA PIN + branch + device serial). */
export async function POST() {
  const gate = await blockIfFeatureMissing('invoicing');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can connect eTIMS.' }, { status: 403 });
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId } });
  try {
    await initialiseDevice(org!);
    return NextResponse.json({ success: true, message: 'Connected to KRA eTIMS.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
