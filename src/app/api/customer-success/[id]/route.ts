import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

const lifecycle = ['ONBOARDING','ADOPTING','ACTIVE','AT_RISK','RENEWAL','CHURNED'];
const renewalStatuses = ['NOT_SET','UPCOMING','RENEWED','AT_RISK','CHURNED'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId;
  if (!session || !organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const current = await prisma.customerSuccessRecord.findFirst({ where: { id: params.id, organizationId } });
  if (!current) return NextResponse.json({ error: 'Customer success record not found' }, { status: 404 });
  const body = await req.json();
  const data: any = {};
  if (body.lifecycleStage !== undefined && lifecycle.includes(body.lifecycleStage)) data.lifecycleStage = body.lifecycleStage;
  if (body.healthScore !== undefined) data.healthScore = Math.max(0, Math.min(100, Number(body.healthScore)));
  if (body.healthStatus !== undefined) data.healthStatus = body.healthStatus;
  if (body.renewalStatus !== undefined && renewalStatuses.includes(body.renewalStatus)) data.renewalStatus = body.renewalStatus;
  if (body.renewalDate !== undefined) data.renewalDate = body.renewalDate ? new Date(body.renewalDate) : null;
  if (body.renewalValue !== undefined) data.renewalValue = body.renewalValue === '' || body.renewalValue == null ? null : Number(body.renewalValue);
  if (body.successOwnerId !== undefined) data.successOwnerId = body.successOwnerId || null;
  if (body.lastReviewAt !== undefined) data.lastReviewAt = body.lastReviewAt ? new Date(body.lastReviewAt) : null;
  if (body.nextReviewAt !== undefined) data.nextReviewAt = body.nextReviewAt ? new Date(body.nextReviewAt) : null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  return NextResponse.json(await prisma.customerSuccessRecord.update({ where: { id: current.id }, data }));
}
