import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrgContext, unauthorized } from '@/lib/tenant';
import { blockIfReadOnly } from '@/lib/subscription';
import { applyIndustryTemplate, findTemplate } from '@/lib/industryTemplates';

/** Setup-wizard status: whether to show it, and which steps are already done. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  const [org, leads, users, channels] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { onboardedAt: true, industry: true } }),
    prisma.lead.count({ where: { organizationId: ctx.orgId } }),
    prisma.user.count({ where: { organizationId: ctx.orgId } }),
    prisma.connectedChannelAccount.count({ where: { organizationId: ctx.orgId, status: 'CONNECTED' } }),
  ]);
  return NextResponse.json({
    // Only new, empty workspaces see the wizard, and only admins can finish it.
    needed: ctx.role === 'ADMIN' && !org?.onboardedAt && leads === 0,
    industry: org?.industry || null,
    steps: { pipeline: Boolean(org?.industry), contacts: leads > 0, channels: channels > 0, team: users > 1 },
  });
}

/** { action: 'template', industry } applies a starter pipeline (only while there are no leads); { action: 'finish' } closes the wizard. */
export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'ADMIN') return NextResponse.json({ error: 'Only workspace admins can do this.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'template') {
    if (!findTemplate(body.industry)) return NextResponse.json({ error: 'Choose an industry.' }, { status: 400 });
    if (await prisma.lead.count({ where: { organizationId: ctx.orgId } })) {
      return NextResponse.json({ error: 'Your workspace already has leads, so its stages can only be changed in Settings → Pipeline.' }, { status: 409 });
    }
    await prisma.$transaction((tx) => applyIndustryTemplate(tx, ctx.orgId, body.industry), { timeout: 20000 });
    return NextResponse.json({ success: true });
  }
  if (body.action === 'finish') {
    await prisma.organization.update({ where: { id: ctx.orgId }, data: { onboardedAt: new Date() } });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
