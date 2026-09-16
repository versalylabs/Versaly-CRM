import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

type ActivityEvent = {
  id: string;
  type:
    | 'lead_created'
    | 'outreach'
    | 'task_created'
    | 'task_completed'
    | 'proposal_created'
    | 'proposal_sent'
    | 'proposal_responded';
  status?: string;
  timestamp: string;
  leadId: string | null;
  leadName: string | null;
  companyName: string | null;
  title: string;
  detail: string | null;
};

function leadLabel(lead: { contactName: string; companyName?: string | null } | null) {
  if (!lead) return 'Unknown lead';
  return lead.companyName ? `${lead.contactName} — ${lead.companyName}` : lead.contactName;
}

// GET /api/activity - unified, reverse-chronological feed built from leads, outreach, tasks, and proposals
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || undefined;
  const leadId = searchParams.get('leadId') || undefined;
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

  try {
    const [leads, outreachLogs, tasks, proposals] = await Promise.all([
      prisma.lead.findMany({
        where: leadId ? { id: leadId } : undefined,
        select: { id: true, contactName: true, companyName: true, dateAdded: true, leadSource: true },
        orderBy: { dateAdded: 'desc' },
        take: 300,
      }),
      prisma.outreachLog.findMany({
        where: leadId ? { leadId } : undefined,
        include: { lead: { select: { id: true, contactName: true, companyName: true } } },
        orderBy: { sentAt: 'desc' },
        take: 300,
      }),
      prisma.task.findMany({
        where: leadId ? { leadId } : undefined,
        include: { lead: { select: { id: true, contactName: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.proposal.findMany({
        where: leadId ? { leadId } : undefined,
        include: { lead: { select: { id: true, contactName: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);

    const events: ActivityEvent[] = [];

    for (const lead of leads) {
      events.push({
        id: `lead-${lead.id}-created`,
        type: 'lead_created',
        timestamp: lead.dateAdded.toISOString(),
        leadId: lead.id,
        leadName: lead.contactName,
        companyName: lead.companyName,
        title: `New lead added: ${leadLabel(lead)}`,
        detail: lead.leadSource ? `Source: ${lead.leadSource.replace('_', ' ').toLowerCase()}` : null,
      });
    }

    for (const log of outreachLogs) {
      events.push({
        id: `outreach-${log.id}`,
        type: 'outreach',
        status: log.status,
        timestamp: log.sentAt.toISOString(),
        leadId: log.lead?.id ?? null,
        leadName: log.lead?.contactName ?? null,
        companyName: log.lead?.companyName ?? null,
        title: `${log.type.replace('_', ' ')} to ${leadLabel(log.lead)} — ${log.status.toLowerCase()}`,
        detail: log.subject || log.content || null,
      });
    }

    for (const task of tasks) {
      events.push({
        id: `task-${task.id}-created`,
        type: 'task_created',
        timestamp: task.createdAt.toISOString(),
        leadId: task.lead?.id ?? null,
        leadName: task.lead?.contactName ?? null,
        companyName: task.lead?.companyName ?? null,
        title: task.lead ? `Task created for ${leadLabel(task.lead)}: ${task.title}` : `Task created: ${task.title}`,
        detail: task.description || null,
      });
      if (task.completed) {
        events.push({
          id: `task-${task.id}-completed`,
          type: 'task_completed',
          timestamp: task.updatedAt.toISOString(),
          leadId: task.lead?.id ?? null,
          leadName: task.lead?.contactName ?? null,
          companyName: task.lead?.companyName ?? null,
          title: task.lead ? `Task completed for ${leadLabel(task.lead)}: ${task.title}` : `Task completed: ${task.title}`,
          detail: null,
        });
      }
    }

    for (const proposal of proposals) {
      events.push({
        id: `proposal-${proposal.id}-created`,
        type: 'proposal_created',
        timestamp: proposal.createdAt.toISOString(),
        leadId: proposal.lead?.id ?? null,
        leadName: proposal.lead?.contactName ?? null,
        companyName: proposal.lead?.companyName ?? null,
        title: `Proposal drafted for ${leadLabel(proposal.lead)}: ${proposal.title}`,
        detail: proposal.value != null ? `Value: $${proposal.value.toLocaleString()}` : null,
      });
      if (proposal.sentAt) {
        events.push({
          id: `proposal-${proposal.id}-sent`,
          type: 'proposal_sent',
          timestamp: proposal.sentAt.toISOString(),
          leadId: proposal.lead?.id ?? null,
          leadName: proposal.lead?.contactName ?? null,
          companyName: proposal.lead?.companyName ?? null,
          title: `Proposal sent to ${leadLabel(proposal.lead)}: ${proposal.title}`,
          detail: null,
        });
      }
      if (proposal.respondedAt) {
        events.push({
          id: `proposal-${proposal.id}-responded`,
          type: 'proposal_responded',
          status: proposal.status,
          timestamp: proposal.respondedAt.toISOString(),
          leadId: proposal.lead?.id ?? null,
          leadName: proposal.lead?.contactName ?? null,
          companyName: proposal.lead?.companyName ?? null,
          title: `Proposal ${proposal.status} by ${leadLabel(proposal.lead)}: ${proposal.title}`,
          detail: null,
        });
      }
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const filtered = type ? events.filter((e) => e.type === type) : events;

    return NextResponse.json(filtered.slice(0, limit));
  } catch (error) {
    console.error('Failed to build activity feed:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
