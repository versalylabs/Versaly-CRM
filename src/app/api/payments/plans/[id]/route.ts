import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';

/** { action: 'cancel' } stops a plan: no more reminders, and it leaves the outstanding totals. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const plan = await prisma.paymentPlan.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
  if (!plan) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.action !== 'cancel') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  if (plan.status !== 'ACTIVE') return NextResponse.json({ error: 'Only active plans can be cancelled.' }, { status: 400 });
  const updated = await prisma.paymentPlan.update({ where: { id: plan.id }, data: { status: 'CANCELLED' } });
  await logLeadActivity(prisma, plan.leadId, 'PAYMENT', `Instalment plan cancelled: ${plan.title}`, { planId: plan.id });
  return NextResponse.json({ plan: updated });
}
