import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';

const VALID_STATUSES = ['PENDING', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED'];

function leadStatus(status: string) {
  return VALID_STATUSES.includes(status) ? status : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const status = body.status ? leadStatus(String(body.status).toUpperCase()) : null;
    if (body.status && !status) {
      return NextResponse.json({ error: 'Invalid outreach status.' }, { status: 400 });
    }

    const log = await prisma.outreachLog.update({
      where: { id: params.id },
      data: {
        ...(status ? {
          status: status as any,
          openedAt: status === 'OPENED' ? new Date() : undefined,
          clickedAt: status === 'CLICKED' ? new Date() : undefined,
          repliedAt: status === 'REPLIED' ? new Date() : undefined,
        } : {}),
        ...(typeof body.subject === 'string' ? { subject: body.subject.trim() || null } : {}),
        ...(typeof body.content === 'string' ? { content: body.content.trim() || null } : {}),
      },
      include: {
        lead: {
          select: { id: true, contactName: true, companyName: true, email: true, pipelineStage: true, nextFollowUp: true },
        },
      },
    });

    if (status) {
      await prisma.lead.update({
        where: { id: log.leadId },
        data: { outreachStatus: status as any },
      });
    }

    return NextResponse.json(log);
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: 'Outreach activity not found.' }, { status: 404 });
    console.error('Failed to update outreach log:', error);
    return NextResponse.json({ error: 'Failed to update outreach activity.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.outreachLog.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: 'Outreach activity not found.' }, { status: 404 });
    console.error('Failed to delete outreach log:', error);
    return NextResponse.json({ error: 'Failed to delete outreach activity.' }, { status: 500 });
  }
}
