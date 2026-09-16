import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import prisma from '../../../../../../lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId;
  if (!session || !organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customer = await prisma.customerSuccessRecord.findFirst({ where: { id: params.id, organizationId } });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: 'Milestone title is required' }, { status: 400 });
  const milestone = await prisma.customerMilestone.create({ data: { customerId: customer.id, title: body.title.trim(), description: body.description || null, dueDate: body.dueDate ? new Date(body.dueDate) : null } });
  return NextResponse.json(milestone, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId;
  if (!session || !organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customer = await prisma.customerSuccessRecord.findFirst({ where: { id: params.id, organizationId } });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  const body = await req.json();
  if (!body.milestoneId) return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 });
  const milestone = await prisma.customerMilestone.findFirst({ where: { id: body.milestoneId, customerId: customer.id } });
  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  return NextResponse.json(await prisma.customerMilestone.update({ where: { id: milestone.id }, data: { completedAt: body.completed ? new Date() : null } }));
}
