import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { createNotification } from '../../../../lib/notifications';

const lifecycle = ['ONBOARDING','ADOPTING','ACTIVE','AT_RISK','RENEWAL','CHURNED'];
const renewalStatuses = ['NOT_SET','UPCOMING','RENEWED','AT_RISK','CHURNED'];

function daysSince(value: Date | null | undefined) {
  if (!value) return 999;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86400000));
}

function calculateHealth(lead: any, tasks: any[], events: any[], renewalDate?: Date | null) {
  let score = 55;
  const recentActivity = events.some((e) => daysSince(e.createdAt) <= 14);
  const recentTask = tasks.some((t) => daysSince(t.updatedAt) <= 14);
  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const daysContact = daysSince(lead.lastContact);

  if (recentActivity) score += 12;
  if (recentTask) score += 8;
  if (lead.outreachStatus === 'REPLIED') score += 10;
  if (lead.pipelineStage === 'WON') score += 5;
  if (daysContact > 30) score -= 12;
  if (daysContact > 60) score -= 8;
  score -= Math.min(20, overdueTasks * 5);

  if (renewalDate) {
    const daysToRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / 86400000);
    if (daysToRenewal <= 30) score -= 5;
    if (daysToRenewal < 0) score -= 10;
  }
  score = Math.max(0, Math.min(100, score));
  const healthStatus = score >= 70 ? 'HEALTHY' : score >= 45 ? 'WATCH' : 'AT_RISK';
  return { score, healthStatus };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId;
  if (!session || !organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  const lifecycleStage = searchParams.get('lifecycleStage') || 'all';

  const customers = await prisma.customerSuccessRecord.findMany({
    where: {
      organizationId,
      ...(status !== 'all' ? { healthStatus: status } : {}),
      ...(lifecycleStage !== 'all' ? { lifecycleStage } : {}),
    },
    include: {
      lead: { select: { id: true, contactName: true, companyName: true, email: true, phone: true, pipelineStage: true, lastContact: true, dealValue: true, outreachStatus: true } },
      successOwner: { select: { id: true, name: true, email: true } },
      milestones: { orderBy: { dueDate: 'asc' } },
    },
    orderBy: [{ healthScore: 'asc' }, { updatedAt: 'desc' }],
  });

  const refreshed = await Promise.all(customers.map(async (customer) => {
    const [tasks, events] = await Promise.all([
      prisma.task.findMany({ where: { organizationId, leadId: customer.leadId }, orderBy: { updatedAt: 'desc' }, take: 30 }),
      prisma.activityEvent.findMany({ where: { leadId: customer.leadId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const health = calculateHealth(customer.lead, tasks, events, customer.renewalDate);
    if (health.score !== customer.healthScore || health.healthStatus !== customer.healthStatus) {
      return prisma.customerSuccessRecord.update({ where: { id: customer.id }, data: { healthScore: health.score, healthStatus: health.healthStatus } }).then((updated) => ({ ...customer, ...updated }));
    }
    return customer;
  }));

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const summary = {
    total: refreshed.length,
    healthy: refreshed.filter((c) => c.healthStatus === 'HEALTHY').length,
    watch: refreshed.filter((c) => c.healthStatus === 'WATCH').length,
    atRisk: refreshed.filter((c) => c.healthStatus === 'AT_RISK').length,
    renewals30: refreshed.filter((c) => c.renewalDate && c.renewalDate >= now && c.renewalDate <= in30).length,
    renewalValue30: refreshed.reduce((sum, c) => sum + (c.renewalDate && c.renewalDate >= now && c.renewalDate <= in30 ? (c.renewalValue || 0) : 0), 0),
  };
  return NextResponse.json({ customers: refreshed, summary });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId;
  if (!session || !organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: body.leadId, organizationId } });
  if (!lead) return NextResponse.json({ error: 'Customer not found in this workspace' }, { status: 404 });

  const existing = await prisma.customerSuccessRecord.findUnique({ where: { leadId: lead.id } });
  if (existing) return NextResponse.json(existing);

  const renewalDate = body.renewalDate ? new Date(body.renewalDate) : null;
  const record = await prisma.customerSuccessRecord.create({
    data: {
      organizationId, leadId: lead.id,
      lifecycleStage: lifecycle.includes(body.lifecycleStage) ? body.lifecycleStage : 'ONBOARDING',
      renewalDate: renewalDate && !Number.isNaN(renewalDate.getTime()) ? renewalDate : null,
      renewalValue: body.renewalValue === '' || body.renewalValue == null ? null : Number(body.renewalValue),
      renewalStatus: renewalStatuses.includes(body.renewalStatus) ? body.renewalStatus : 'NOT_SET',
      successOwnerId: body.successOwnerId || null,
      notes: body.notes || null,
    },
  });
  await createNotification({ userId: session.user.id!, type: 'CUSTOMER_SUCCESS_CREATED', title: 'Customer success record created', message: `Success tracking is now active for ${lead.contactName}.`, href: '/customer-success' });
  return NextResponse.json(record, { status: 201 });
}
