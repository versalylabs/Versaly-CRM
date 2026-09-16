import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';
import { createNotification, leadHref } from '../../../../../lib/notifications';
import { executeAutomationWorkflows } from '../../../../../lib/workflows';

// GET /api/leads/:id - fetch a single lead with its related records
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      tasks: { include: { assignedTo: { select: { id: true, name: true, email: true } } }, orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }] },
      proposals: { orderBy: { createdAt: 'desc' } },
      outreachLogs: { orderBy: { sentAt: 'desc' } },
      activityEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!lead || (session.user?.organizationId && lead.organizationId && lead.organizationId !== session.user.organizationId)) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead);
}

// PATCH /api/leads/:id - update a lead
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const existing = await prisma.lead.findUnique({
    where: { id: params.id },
    select: { id: true, contactName: true, assignedToId: true, pipelineStage: true, organizationId: true }
  });
  if (!existing || (session.user?.organizationId && existing.organizationId && existing.organizationId !== session.user.organizationId)) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const data: any = {};
  const allowedFields = [
    'companyName',
    'contactName',
    'jobTitle',
    'email',
    'phone',
    'website',
    'location',
    'businessType',
    'instagram',
    'linkedin',
    'facebook',
    'leadSource',
    'pipelineStage',
    'outreachStatus',
    'notes',
    'assignedToId',
  ];

  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field] === '' ? null : body[field];
    }
  }

  if ('dealValue' in body) {
    data.dealValue = body.dealValue === '' || body.dealValue === null
      ? null
      : parseFloat(body.dealValue);
  }

  if ('lastContact' in body) {
    data.lastContact = body.lastContact ? new Date(body.lastContact) : null;
  }

  if ('nextFollowUp' in body) {
    data.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null;
  }

  try {
    const lead = await prisma.lead.update({
      where: { id: params.id },
      data,
      include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
      await createNotification({ userId: data.assignedToId, type: 'LEAD_ASSIGNED', title: 'Lead assigned to you', message: `${lead.contactName} is now assigned to you.`, href: leadHref(lead.id), category: 'lead' });
    }
    if (lead.organizationId && data.pipelineStage && data.pipelineStage !== existing.pipelineStage) {
      try { await executeAutomationWorkflows({ organizationId: lead.organizationId || session.user?.organizationId || '', triggerType: 'LEAD_STAGE_CHANGED', leadId: lead.id, eventId: `stage:${lead.id}:${lead.updatedAt.getTime()}` }); }
      catch (automationError) { console.error('Workflow automation failed after stage change:', automationError); }
    }
    if (lead.organizationId && Object.keys(data).some((k) => k !== 'pipelineStage') && !(data.pipelineStage && data.pipelineStage !== existing.pipelineStage)) { try { await executeAutomationWorkflows({ organizationId: lead.organizationId, triggerType: 'LEAD_UPDATED', leadId: lead.id, eventId: `lead-updated:${lead.id}:${lead.updatedAt.getTime()}` }); } catch (e) { console.error('Lead-updated workflow failed:', e); } }
    return NextResponse.json(lead);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'A lead with this email already exists in this workspace' },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/:id - delete a lead
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true }
    });
    if (!existing || (session.user?.organizationId && existing.organizationId && existing.organizationId !== session.user.organizationId)) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
