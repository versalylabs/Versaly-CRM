import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

type SearchItem = {
  id: string;
  type: 'Lead' | 'Task' | 'Proposal' | 'Calendar' | 'Outreach' | 'User' | 'Page';
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
};

const PAGES: SearchItem[] = [
  { id: 'page-dashboard', type: 'Page', title: 'Dashboard', subtitle: 'CRM overview', href: '/', icon: '📊' },
  { id: 'page-leads', type: 'Page', title: 'Leads', subtitle: 'Manage real estate prospects', href: '/leads', icon: '👥' },
  { id: 'page-pipeline', type: 'Page', title: 'Pipeline', subtitle: 'Sales pipeline board', href: '/pipeline', icon: '📈' },
  { id: 'page-outreach', type: 'Page', title: 'Outreach', subtitle: 'Prospecting activity', href: '/outreach', icon: '📧' },
  { id: 'page-email', type: 'Page', title: 'Email', subtitle: 'Email communication', href: '/email', icon: '✉️' },
  { id: 'page-calendar', type: 'Page', title: 'Calendar', subtitle: 'Schedule meetings and follow-ups', href: '/calendar', icon: '📅' },
  { id: 'page-integrations', type: 'Page', title: 'Integrations', subtitle: 'Connected services', href: '/integrations', icon: '🔗' },
  { id: 'page-proposals', type: 'Page', title: 'Proposals', subtitle: 'Manage proposals', href: '/proposals', icon: '📋' },
  { id: 'page-tasks', type: 'Page', title: 'Tasks', subtitle: 'Action items', href: '/tasks', icon: '✅' },
  { id: 'page-activity', type: 'Page', title: 'Activity', subtitle: 'CRM activity history', href: '/activity', icon: '📝' },
  { id: 'page-reports', type: 'Page', title: 'Reports', subtitle: 'CRM analytics', href: '/reports', icon: '📊' },
  { id: 'page-notifications', type: 'Page', title: 'Notifications', subtitle: 'Alerts and reminders', href: '/notifications', icon: '🔔' },
  { id: 'page-settings', type: 'Page', title: 'Settings', subtitle: 'CRM preferences', href: '/settings', icon: '⚙️' },
];

function visibleForUser<T extends { assignedToId?: string | null }>(items: T[], role?: string, userId?: string) {
  if (role === 'ADMIN' || role === 'MANAGER') return items;
  return items.filter((item) => !item.assignedToId || item.assignedToId === userId);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: PAGES.slice(0, 8) });
  }

  const term = q.toLowerCase();
  const contains = { contains: q };

  try {
    const [leads, tasks, proposals, events, outreach, users] = await Promise.all([
      prisma.lead.findMany({
        where: { OR: [{ contactName: contains }, { companyName: contains }, { email: contains }] },
        select: { id: true, contactName: true, companyName: true, email: true, assignedToId: true },
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { OR: [{ title: contains }, { description: contains }] },
        select: { id: true, title: true, description: true, assignedToId: true, completed: true },
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.proposal.findMany({
        where: { OR: [{ title: contains }, { description: contains }] },
        select: { id: true, title: true, status: true, lead: { select: { contactName: true, companyName: true } } },
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.calendarEvent.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { location: contains }] },
        select: { id: true, title: true, type: true, startAt: true, assignedToId: true },
        take: 8,
        orderBy: { startAt: 'asc' },
      }),
      prisma.outreachLog.findMany({
        where: { OR: [{ subject: contains }, { content: contains }, { type: contains }] },
        select: { id: true, type: true, subject: true, content: true, lead: { select: { contactName: true, companyName: true } } },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      (session.user.role === 'ADMIN' || session.user.role === 'MANAGER')
        ? prisma.user.findMany({
            where: { isActive: true, OR: [{ name: contains }, { email: contains }] },
            select: { id: true, name: true, email: true, role: true },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    const results: SearchItem[] = [];

    visibleForUser(leads, session.user.role, session.user.id).forEach((lead) => {
      results.push({
        id: `lead-${lead.id}`,
        type: 'Lead',
        title: lead.companyName ? `${lead.contactName} — ${lead.companyName}` : lead.contactName,
        subtitle: lead.email,
        href: `/leads/${lead.id}`,
        icon: '👥',
      });
    });

    visibleForUser(tasks, session.user.role, session.user.id).forEach((task) => {
      results.push({
        id: `task-${task.id}`,
        type: 'Task',
        title: task.title,
        subtitle: task.completed ? 'Completed task' : task.description || 'Open task',
        href: '/tasks',
        icon: '✅',
      });
    });

    proposals.forEach((proposal) => {
      results.push({
        id: `proposal-${proposal.id}`,
        type: 'Proposal',
        title: proposal.title,
        subtitle: `${proposal.status} • ${proposal.lead.companyName || proposal.lead.contactName}`,
        href: '/proposals',
        icon: '📋',
      });
    });

    visibleForUser(events, session.user.role, session.user.id).forEach((event) => {
      results.push({
        id: `calendar-${event.id}`,
        type: 'Calendar',
        title: event.title,
        subtitle: `${event.type.replace('_', ' ')} • ${new Date(event.startAt).toLocaleString()}`,
        href: '/calendar',
        icon: '📅',
      });
    });

    outreach.forEach((item) => {
      results.push({
        id: `outreach-${item.id}`,
        type: 'Outreach',
        title: item.subject || item.type,
        subtitle: item.lead.companyName || item.lead.contactName,
        href: '/outreach',
        icon: '📧',
      });
    });

    users.forEach((user) => {
      results.push({
        id: `user-${user.id}`,
        type: 'User',
        title: user.name || user.email,
        subtitle: `${user.role} • ${user.email}`,
        href: '/admin/users',
        icon: '👤',
      });
    });

    PAGES.filter((page) => `${page.title} ${page.subtitle || ''}`.toLowerCase().includes(term)).forEach((page) => results.push(page));

    return NextResponse.json({ results: results.slice(0, 40) });
  } catch (error) {
    console.error('Global search failed:', error);
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 500 });
  }
}
