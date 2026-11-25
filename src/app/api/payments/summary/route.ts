import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { ageingBucket, type AgeingBucket } from '@/lib/mpesa';

export const dynamic = 'force-dynamic';

/** Collections dashboard: received today / this month, outstanding instalments, unmatched count, debtor ageing. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const paid = { organizationId: ctx.orgId, status: 'PAID' };

  const [todaySum, monthSum, unmatched, accounts, installments] = await Promise.all([
    prisma.payment.aggregate({ where: { ...paid, paidAt: { gte: today } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { ...paid, paidAt: { gte: month } }, _sum: { amount: true }, _count: true }),
    prisma.payment.count({ where: { ...paid, leadId: null } }),
    prisma.mpesaAccount.count({ where: { organizationId: ctx.orgId } }),
    prisma.installment.findMany({
      where: { plan: { organizationId: ctx.orgId, status: 'ACTIVE' } },
      select: { amount: true, paidAmount: true, dueDate: true, plan: { select: { leadId: true, lead: { select: { contactName: true, companyName: true } } } } },
    }),
  ]);

  const buckets: Record<AgeingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const debtors = new Map<string, { leadId: string; name: string; company: string | null; overdue: number; outstanding: number; oldestDue: Date | null }>();
  let outstanding = 0;
  for (const i of installments) {
    const left = i.amount - i.paidAmount;
    if (left <= 0) continue;
    outstanding += left;
    const bucket = ageingBucket(i.dueDate, now);
    buckets[bucket] += left;
    const d = debtors.get(i.plan.leadId) || { leadId: i.plan.leadId, name: i.plan.lead.contactName, company: i.plan.lead.companyName, overdue: 0, outstanding: 0, oldestDue: null };
    d.outstanding += left;
    if (bucket !== 'current') {
      d.overdue += left;
      if (!d.oldestDue || i.dueDate < d.oldestDue) d.oldestDue = i.dueDate;
    }
    debtors.set(i.plan.leadId, d);
  }

  return NextResponse.json({
    connected: accounts > 0,
    today: { amount: todaySum._sum.amount || 0, count: todaySum._count },
    month: { amount: monthSum._sum.amount || 0, count: monthSum._count },
    outstanding,
    overdue: outstanding - buckets.current,
    unmatched,
    ageing: buckets,
    debtors: [...debtors.values()].filter((d) => d.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 50),
  });
}
