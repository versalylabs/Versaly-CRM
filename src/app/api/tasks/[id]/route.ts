import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';
import { createNotification, taskHref } from '../../../../../lib/notifications';
import { executeAutomationWorkflows } from '../../../../../lib/workflows';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const data: any = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if ('description' in body) data.description = String(body.description || '').trim() || null;
    if ('completed' in body) data.completed = Boolean(body.completed);
    if (body.priority) data.priority = String(body.priority).toLowerCase();
    if ('dueDate' in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if ('assignedToId' in body) {
      if (body.assignedToId) {
        const user = await prisma.user.findFirst({ where: { id: body.assignedToId, isActive: true } });
        if (!user) return NextResponse.json({ error: 'Selected assignee was not found or is inactive.' }, { status: 404 });
      }
      data.assignedToId = body.assignedToId || null;
    }
    let wasCompleted = false;
    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({ where: { id: params.id, organizationId: session.user?.organizationId || undefined } });
      if (!existing) throw new Error('Task not found.');
      const updated = await tx.task.update({ where: { id: params.id }, data, include: { lead: { select: { id: true, contactName: true, companyName: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true, role: true } } } });
      if (updated.assignedToId && existing && updated.assignedToId !== existing.assignedToId) await createNotification({ userId: updated.assignedToId, type: 'TASK_ASSIGNED', title: 'Task assigned to you', message: `"${updated.title}" was assigned to you.`, href: taskHref(), category: 'task' });
      if (updated.leadId && existing && data.completed !== undefined && existing.completed !== updated.completed) {
        await logLeadActivity(tx, updated.leadId, 'TASK', updated.completed ? 'Task completed' : 'Task reopened', { taskId: updated.id, title: updated.title });
      }
      wasCompleted = Boolean(existing && !existing.completed && updated.completed);
      return updated;
    });
    if (task.organizationId && wasCompleted && task.completed) { try { await executeAutomationWorkflows({ organizationId: task.organizationId, triggerType: 'TASK_COMPLETED', taskId: task.id, leadId: task.leadId, eventId: `task-completed:${task.id}:${task.updatedAt.getTime()}` }); } catch (e) { console.error('Task-completed workflow failed:', e); } }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await prisma.task.delete({ where: { id: params.id, organizationId: session.user?.organizationId || undefined } }); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 }); }
}
