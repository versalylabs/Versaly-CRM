import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { blockIfReadOnly } from '@/lib/subscription';
import { PLAN_QUOTAS, UNLIMITED, normalizePlan } from '@/lib/plans';
import { CUSTOM_FIELD_TYPES, customFieldKey } from '@/lib/customFields';

const managerOnly = () => NextResponse.json({ error: 'Only admins and managers can change custom fields.' }, { status: 403 });

function cleanOptions(type: string, options: unknown): string[] | null | { error: string } {
  if (type !== 'select') return null;
  const list = (Array.isArray(options) ? options : String(options || '').split(','))
    .map((o) => String(o).trim())
    .filter(Boolean)
    .slice(0, 50);
  return list.length ? Array.from(new Set(list)) : { error: 'A dropdown needs at least one choice.' };
}

/** The workspace's custom lead fields, in display order. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const [fields, org] = await Promise.all([
    prisma.customField.findMany({ where: { organizationId: ctx.orgId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true } }),
  ]);
  const limit = PLAN_QUOTAS[normalizePlan(org?.plan)].customFields;
  return NextResponse.json({ fields, limit: limit >= UNLIMITED ? null : limit });
}

/** Create a field: { label, type, options?, required? }. */
export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return managerOnly();

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || '').trim().slice(0, 60);
  const type = String(body.type || 'text');
  if (!label) return NextResponse.json({ error: 'Give the field a name.' }, { status: 400 });
  if (!(type in CUSTOM_FIELD_TYPES)) return NextResponse.json({ error: 'Choose a field type.' }, { status: 400 });
  const options = cleanOptions(type, body.options);
  if (options && 'error' in options) return NextResponse.json(options, { status: 400 });

  const [org, count] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { plan: true } }),
    prisma.customField.count({ where: { organizationId: ctx.orgId } }),
  ]);
  const limit = PLAN_QUOTAS[normalizePlan(org?.plan)].customFields;
  if (count >= limit) {
    return NextResponse.json(
      { error: limit === 0 ? 'Custom fields are included from the Starter plan. Upgrade to add them.' : `Your plan includes ${limit} custom fields. Upgrade for more.`, upgradeRequired: true },
      { status: 403 }
    );
  }

  // Keys must be unique in the workspace; add a number if the label repeats.
  let key = customFieldKey(label);
  for (let n = 2; await prisma.customField.findUnique({ where: { organizationId_key: { organizationId: ctx.orgId, key } } }); n++) key = `${customFieldKey(label)}_${n}`;

  const field = await prisma.customField.create({
    data: { organizationId: ctx.orgId, key, label, type, options: options ?? undefined, required: Boolean(body.required), order: count },
  });
  return NextResponse.json({ field }, { status: 201 });
}

/** Update a field's label, choices or required flag: { id, label?, options?, required? }. The type and key never change. */
export async function PATCH(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return managerOnly();
  const body = await req.json().catch(() => ({}));
  const field = await prisma.customField.findFirst({ where: { id: String(body.id || ''), organizationId: ctx.orgId } });
  if (!field) return NextResponse.json({ error: 'Field not found.' }, { status: 404 });
  const data: Record<string, unknown> = {};
  if (typeof body.label === 'string' && body.label.trim()) data.label = body.label.trim().slice(0, 60);
  if ('required' in body) data.required = Boolean(body.required);
  if ('options' in body) {
    const options = cleanOptions(field.type, body.options);
    if (options && 'error' in options) return NextResponse.json(options, { status: 400 });
    if (options) data.options = options;
  }
  const updated = await prisma.customField.update({ where: { id: field.id }, data });
  return NextResponse.json({ field: updated });
}

/** Delete a field (?id=). Values already stored on leads are kept but no longer shown. */
export async function DELETE(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return managerOnly();
  const id = req.nextUrl.searchParams.get('id') || '';
  const { count } = await prisma.customField.deleteMany({ where: { id, organizationId: ctx.orgId } });
  return count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Field not found.' }, { status: 404 });
}
