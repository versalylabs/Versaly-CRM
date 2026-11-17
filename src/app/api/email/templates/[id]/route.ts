import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import prisma from '../../../../../../lib/prisma';
import { getOrgContext, unauthorized } from '../../../../../../lib/tenant';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.subject !== undefined) data.subject = String(body.subject).trim();
  if (body.body !== undefined) data.body = String(body.body).trim();
  if (body.category !== undefined) data.category = String(body.category).trim() || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  if ((data.name !== undefined && !data.name) || (data.subject !== undefined && !data.subject) || (data.body !== undefined && !data.body)) {
    return NextResponse.json({ error: 'Name, subject, and body cannot be empty.' }, { status: 400 });
  }

  try {
    const template = await prisma.emailTemplate.update({ where: { id: params.id, organizationId: ctx.orgId }, data });
    return NextResponse.json(template);
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    if (error?.code === 'P2002') return NextResponse.json({ error: 'A template with that name already exists.' }, { status: 409 });
    return NextResponse.json({ error: 'Could not update email template.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return unauthorized();
  try {
    await prisma.emailTemplate.delete({ where: { id: params.id, organizationId: ctx.orgId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    return NextResponse.json({ error: 'Could not delete email template.' }, { status: 500 });
  }
}
