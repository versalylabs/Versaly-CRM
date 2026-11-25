import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { toCsv } from '@/lib/csv';

/** Download all of the workspace's leads as CSV (admins and managers; also covers data-access requests). */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can export leads.' }, { status: 403 });

  const leads = await prisma.lead.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    include: { assignedTo: { select: { name: true, email: true } } },
  });
  const header = ['Contact name', 'Email', 'Phone', 'Company', 'Job title', 'Location', 'Website', 'Stage', 'Source', 'Deal value (KES)', 'Owner', 'Last contact', 'Next follow-up', 'Notes', 'Created'];
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  const rows = leads.map((l) => [
    l.contactName, l.email, l.phone, l.companyName, l.jobTitle, l.location, l.website, l.pipelineStage, l.leadSource, l.dealValue,
    l.assignedTo?.name || l.assignedTo?.email || '', day(l.lastContact), day(l.nextFollowUp), l.notes, day(l.createdAt),
  ]);
  return new NextResponse(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="versalylabs-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
