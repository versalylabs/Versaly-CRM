import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';
import prisma from '../../../../lib/prisma';
import { logLeadActivity } from '../../../../lib/automation';
import { createNotification, taskHref } from '../../../../lib/notifications';
import { executeAutomationWorkflows } from '../../../../lib/workflows';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

function priority(value: unknown) {
  const p = String(value || 'MEDIUM').trim().toUpperCase();
  return PRIORITIES.includes(p) ? p.toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const p = searchParams.get('priority');
  const search = searchParams.get('search')?.trim();
  const where: any = { ...(session.user?.organizationId ? { organizationId: session.user.organizationId } : {}) };
  if (status === 'completed') where.completed = true;
  if (status === 'open') where.completed = false;
  if (p) where.priority = p.toLowerCase();
  if (search) where.OR = [
    { title: { contains: search } },
    { description: { contains: search } },
    { lead: { is: { contactName: { contains: search } } } },
    { lead: { is: { companyName: { contains: search } } } },
  ];
  const tasks = await prisma.task.findMany({
    where,
    include: { lead: { select: { id: true, contactName: true, companyName: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const taskPriority = priority(body.priority);
    if (!title || !taskPriority) return NextResponse.json({ error: 'A task title and valid priority are required.' }, { status: 400 });
    let dueDate: Date | null = null;
    if (body.dueDate) {
      dueDate = new Date(body.dueDate);
      if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
    }
    if (body.assignedToId) {
      const user = await prisma.user.findFirst({ where: { id: body.assignedToId, isActive: true } });
      if (!user) return NextResponse.json({ error: 'Selected assignee was not found or is inactive.' }, { status: 404 });
    }
    if (body.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
      if (!lead) return NextResponse.json({ error: 'Selected lead was not found.' }, { status: 404 });
    }
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: { organizationId: session.user?.organizationId || null, title, description: String(body.description || '').trim() || null, leadId: body.leadId || null, dueDate, priority: taskPriority, assignedToId: body.assignedToId || null },
        include: { lead: { select: { id: true, contactName: true, companyName: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true, role: true } } },
      });
      if (created.leadId) await logLeadActivity(tx, created.leadId, 'TASK', 'Task created', { taskId: created.id, title: created.title, dueDate: created.dueDate?.toISOString() || null, automated: false });
      return created;
    });
    if (task.organizationId) { try { await executeAutomationWorkflows({ organizationId: task.organizationId, triggerType: 'TASK_CREATED', taskId: task.id, leadId: task.leadId, eventId: `task-created:${task.id}` }); } catch (e) { console.error('Task-created workflow failed:', e); } }
    if (task.assignedToId) await createNotification({ userId: task.assignedToId, type: 'TASK_ASSIGNED', title: 'New task assigned', message: `"${task.title}" was assigned to you.`, href: taskHref(), category: 'task' });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }
}
