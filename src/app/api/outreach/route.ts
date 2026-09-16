import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';
import prisma from '../../../../lib/prisma';
import { createAutomaticFollowUpTask, logLeadActivity, isActiveStage } from '../../../../lib/automation';
import { executeAutomationWorkflows } from '../../../../lib/workflows';
import { createNotification, outreachHref } from '../../../../lib/notifications';

const VALID_TYPES = ['EMAIL', 'PHONE_CALL', 'WHATSAPP', 'LINKEDIN', 'INSTAGRAM', 'SMS', 'OTHER'];
const VALID_STATUSES = ['PENDING', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED'];

function normalizeType(value: unknown) {
  const raw = String(value || '').trim().toUpperCase();
  return VALID_TYPES.includes(raw) ? raw : null;
}

function normalizeStatus(value: unknown) {
  const raw = String(value || '').trim().toUpperCase();
  return VALID_STATUSES.includes(raw) ? raw : null;
}

function outreachStatusForLead(status: string) {
  if (status === 'REPLIED') return 'REPLIED';
  if (status === 'OPENED') return 'OPENED';
  if (status === 'CLICKED') return 'CLICKED';
  if (status === 'BOUNCED') return 'BOUNCED';
  if (status === 'SENT') return 'SENT';
  return 'PENDING';
}

// GET /api/outreach - list outreach activity with optional filters
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId') || undefined;
  const type = searchParams.get('type') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search')?.trim();

  const where: any = {};
  if (leadId) where.leadId = leadId;
  if (type) where.type = type;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { subject: { contains: search } },
      { content: { contains: search } },
      { lead: { is: { contactName: { contains: search } } } },
      { lead: { is: { companyName: { contains: search } } } },
      { lead: { is: { email: { contains: search } } } },
    ];
  }

  const logs = await prisma.outreachLog.findMany({
    where,
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          email: true,
          pipelineStage: true,
          nextFollowUp: true,
        },
      },
    },
    orderBy: { sentAt: 'desc' },
  });

  return NextResponse.json(logs);
}

// POST /api/outreach - record a new outreach interaction
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const type = normalizeType(body.type);
    const status = normalizeStatus(body.status || 'SENT');

    if (!body.leadId || !type || !status) {
      return NextResponse.json(
        { error: 'A lead, outreach type, and valid status are required.' },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });

    const sentAt = body.sentAt ? new Date(body.sentAt) : new Date();
    if (Number.isNaN(sentAt.getTime())) {
      return NextResponse.json({ error: 'Invalid outreach date.' }, { status: 400 });
    }

    const nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null;
    if (nextFollowUp && Number.isNaN(nextFollowUp.getTime())) {
      return NextResponse.json({ error: 'Invalid follow-up date.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.outreachLog.create({
        data: {
          leadId: body.leadId,
          type,
          subject: body.subject?.trim() || null,
          content: body.content?.trim() || null,
          status: status as any,
          sentAt,
          openedAt: status === 'OPENED' ? sentAt : null,
          clickedAt: status === 'CLICKED' ? sentAt : null,
          repliedAt: status === 'REPLIED' ? sentAt : null,
        },
        include: {
          lead: {
            select: {
              id: true,
              contactName: true,
              companyName: true,
              email: true,
              pipelineStage: true,
              nextFollowUp: true,
            },
          },
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: body.leadId },
        data: {
          lastContact: sentAt,
          outreachStatus: outreachStatusForLead(status) as any,
          ...(nextFollowUp ? { nextFollowUp, ...(isActiveStage(lead.pipelineStage) && lead.pipelineStage !== 'PROPOSAL' ? { pipelineStage: 'FOLLOW_UP' as any } : {}) } : {}),
        },
      });

      let autoTaskCreated = false;
      if (nextFollowUp) {
        const autoTask = await createAutomaticFollowUpTask(tx, {
          leadId: lead.id,
          dueDate: nextFollowUp,
          assignedToId: lead.assignedToId,
          outreachType: type,
          subject: body.subject || lead.contactName,
        });
        autoTaskCreated = autoTask.created;
      }

      await logLeadActivity(tx, lead.id, 'OUTREACH', `Logged ${type.toLowerCase()} outreach`, { status, sentAt: sentAt.toISOString(), nextFollowUp: nextFollowUp?.toISOString() || null, autoFollowUpTaskCreated: autoTaskCreated });
      if (autoTaskCreated && nextFollowUp) await logLeadActivity(tx, lead.id, 'AUTOMATION', 'Automatic follow-up task created', { dueDate: nextFollowUp.toISOString() });

      return { ...log, automation: { followUpTaskCreated: autoTaskCreated }, lead: updatedLead };
    });

    if (status === 'REPLIED' && lead.assignedToId) await createNotification({ userId: lead.assignedToId, type: 'LEAD_REPLY', title: 'Lead replied', message: `${lead.contactName} has replied to your outreach.`, href: outreachHref(), category: 'lead' });

    const orgId = lead.organizationId || session.user?.organizationId;
    if (orgId) {
      try {
        await executeAutomationWorkflows({
          organizationId: orgId,
          triggerType: status === 'REPLIED' ? 'OUTREACH_REPLIED' : 'OUTREACH_SENT',
          leadId: lead.id,
          outreachType: type,
          outreachStatus: status,
        });
      } catch (automationError) {
        console.error('Workflow automation failed after outreach:', automationError);
      }
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to create outreach log:', error);
    return NextResponse.json({ error: 'Failed to save outreach activity.' }, { status: 500 });
  }
}
