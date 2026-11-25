import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, isManagerRole, unauthorized } from '@/lib/tenant';
import { blockIfReadOnly } from '@/lib/subscription';
import { cleanImportedLead, type CleanLead, type ImportedLead } from '@/lib/leadImport';
import { getStageGroups } from '@/lib/stages';

const MAX_ROWS = 2000;

/** Bulk-create leads from a parsed spreadsheet: { leads: ImportedLead[] } -> { created, skipped: [{ row, reason }] }. */
export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (!isManagerRole(ctx.role)) return NextResponse.json({ error: 'Only admins and managers can import leads.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rows: ImportedLead[] = Array.isArray(body.leads) ? body.leads : [];
  if (!rows.length) return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Import up to ${MAX_ROWS} rows at a time. Split the file and try again.` }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { leadLimit: true, _count: { select: { leads: true } } } });
  if (!org) return unauthorized();

  // Existing contacts in this workspace, so re-importing a file does not create duplicates.
  const existing = await prisma.lead.findMany({ where: { organizationId: ctx.orgId }, select: { email: true, phone: true } });
  const seenEmails = new Set(existing.map((l) => l.email?.toLowerCase()).filter(Boolean) as string[]);
  const seenPhones = new Set(existing.map((l) => l.phone).filter(Boolean) as string[]);

  const skipped: { row: number; reason: string }[] = [];
  const toCreate: CleanLead[] = [];
  let room = Math.max(0, org.leadLimit - org._count.leads);
  rows.forEach((row, i) => {
    const result = cleanImportedLead(row);
    const rowNumber = i + 2; // spreadsheet row, after the header
    if ('error' in result) return void skipped.push({ row: rowNumber, reason: result.error });
    const { lead } = result;
    if ((lead.email && seenEmails.has(lead.email)) || (lead.phone && seenPhones.has(lead.phone))) {
      return void skipped.push({ row: rowNumber, reason: 'Already in your CRM' });
    }
    if (room <= 0) return void skipped.push({ row: rowNumber, reason: 'Plan lead limit reached' });
    if (lead.email) seenEmails.add(lead.email);
    if (lead.phone) seenPhones.add(lead.phone);
    toCreate.push(lead);
    room--;
  });

  const firstStage = (await getStageGroups(ctx.orgId)).active[0] || 'NEW_LEAD';
  const { count } = await prisma.lead.createMany({
    data: toCreate.map((lead) => ({ ...lead, organizationId: ctx.orgId, leadSource: 'OTHER' as const, pipelineStage: firstStage, assignedToId: ctx.userId })),
    skipDuplicates: true,
  });
  return NextResponse.json({ created: count, skipped });
}
