import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { createNotification } from '../../../../../lib/notifications';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const userId = session.user.id;
  const created: string[] = [];

  const add = async (type: string, title: string, message: string, href: string, category: any) => {
    const existing = await prisma.notification.findFirst({
      where: { userId, type, message, read: false },
      select: { id: true },
    });
    if (existing) return;
    const result = await createNotification({ userId, type, title, message, href, category });
    if (result) created.push(type);
  };

  const overdueTasks = await prisma.task.findMany({
    where: { assignedToId: userId, completed: false, dueDate: { lt: now } },
    take: 10,
    orderBy: { dueDate: 'asc' },
  });
  for (const task of overdueTasks) {
    await add('TASK_OVERDUE', 'Task overdue', `"${task.title}" is overdue.`, '/tasks', 'task');
  }

  const dueFollowUps = await prisma.lead.findMany({
    where: { assignedToId: userId, nextFollowUp: { not: null, lte: now }, pipelineStage: { notIn: ['WON', 'LOST'] } },
    take: 10,
    orderBy: { nextFollowUp: 'asc' },
  });
  for (const lead of dueFollowUps) {
    await add('FOLLOW_UP_DUE', 'Follow-up due', `Follow up with ${lead.contactName}.`, `/leads/${lead.id}`, 'followUp');
  }

  const soon = new Date(now.getTime() + 60 * 60 * 1000);
  const events = await prisma.calendarEvent.findMany({
    where: { assignedToId: userId, completed: false, startAt: { gte: now, lte: soon } },
    take: 10,
    orderBy: { startAt: 'asc' },
  });
  for (const event of events) {
    await add('CALENDAR_REMINDER', 'Upcoming calendar event', `"${event.title}" starts within the next hour.`, '/calendar', 'calendar');
  }

  const isManager = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';
  if (isManager) {
    const unassignedLeads = await prisma.lead.count({ where: { assignedToId: null, pipelineStage: { notIn: ['WON', 'LOST'] } } });
    if (unassignedLeads > 0) await add('UNASSIGNED_LEADS', 'Unassigned leads', `${unassignedLeads} active lead(s) are currently unassigned.`, '/leads', 'lead');
    const unassignedTasks = await prisma.task.count({ where: { assignedToId: null, completed: false } });
    if (unassignedTasks > 0) await add('UNASSIGNED_TASKS', 'Unassigned tasks', `${unassignedTasks} open task(s) are currently unassigned.`, '/tasks', 'task');
  }

  return NextResponse.json({ created, count: created.length });
}
