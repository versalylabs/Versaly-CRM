import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { blockIfFeatureMissing, blockIfReadOnly } from '@/lib/subscription';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { logLeadActivity } from '@/lib/automation';
import { buildSchedule } from '@/lib/mpesa';

/** Instalment plans, optionally for one customer (?leadId=). */
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const leadId = req.nextUrl.searchParams.get('leadId');
  const plans = await prisma.paymentPlan.findMany({
    where: { organizationId: ctx.orgId, ...(leadId ? { leadId } : {}) },
    include: { installments: { orderBy: { dueDate: 'asc' } }, lead: { select: { id: true, contactName: true, companyName: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  return NextResponse.json({ plans });
}

/** { leadId, title, total, deposit, count, firstDue (YYYY-MM-DD), frequency: 'monthly' | 'weekly' } */
export async function POST(req: NextRequest) {
  const gate = await blockIfFeatureMissing('instalment_plans');
  if (gate) return gate;
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const b = await req.json().catch(() => ({}));
  const lead = await prisma.lead.findFirst({ where: { id: String(b.leadId || ''), organizationId: ctx.orgId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  const title = String(b.title || '').trim().slice(0, 80);
  if (!title) return NextResponse.json({ error: 'Give the plan a name, e.g. "School fees Term 1".' }, { status: 400 });
  const firstDue = new Date(String(b.firstDue || ''));
  if (Number.isNaN(firstDue.getTime())) return NextResponse.json({ error: 'Choose the first due date.' }, { status: 400 });

  let schedule;
  try {
    schedule = buildSchedule({
      total: Math.round(Number(b.total)),
      deposit: Math.round(Number(b.deposit || 0)),
      count: Math.round(Number(b.count)),
      firstDue,
      frequency: b.frequency === 'weekly' ? 'weekly' : 'monthly',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const plan = await prisma.paymentPlan.create({
    data: {
      organizationId: ctx.orgId,
      leadId: lead.id,
      title,
      totalAmount: schedule.reduce((s, r) => s + r.amount, 0),
      createdById: ctx.userId,
      installments: { create: schedule },
    },
    include: { installments: { orderBy: { dueDate: 'asc' } } },
  });
  await logLeadActivity(prisma, lead.id, 'PAYMENT', `Instalment plan created: ${title} (KES ${plan.totalAmount.toLocaleString('en-US')}, ${schedule.length} payments)`, { planId: plan.id });
  return NextResponse.json({ plan }, { status: 201 });
}
