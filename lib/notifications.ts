import prisma from '@/lib/prisma';

export type NotificationCategory = 'task' | 'lead' | 'followUp' | 'proposal' | 'calendar' | 'email';

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  category?: NotificationCategory;
};

const preferenceField: Record<NotificationCategory, string> = {
  task: 'taskNotifications',
  lead: 'leadNotifications',
  followUp: 'followUpNotifications',
  proposal: 'proposalNotifications',
  calendar: 'calendarNotifications',
  email: 'emailNotifications',
};

async function allows(userId: string, category?: NotificationCategory) {
  if (!category) return true;
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!pref) return true;
  return Boolean((pref as any)[preferenceField[category]]);
}

export async function createNotification(input: NotificationInput) {
  try {
    if (!(await allows(input.userId, input.category))) return null;
    const { category: _category, ...data } = input;
    return await prisma.notification.create({ data });
  } catch (error) {
    console.error('Notification creation failed', error);
    return null;
  }
}

export async function notifyMany(userIds: Array<string | null | undefined>, input: Omit<NotificationInput, 'userId'>) {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!uniqueIds.length) return [];
  return Promise.all(uniqueIds.map((userId) => createNotification({ userId, ...input })));
}

export async function getManagerIds() {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export function leadHref(id: string) { return `/leads/${id}`; }
export function taskHref() { return '/tasks'; }
export function proposalHref() { return '/proposals'; }
export function calendarHref() { return '/calendar'; }
export function outreachHref() { return '/outreach'; }
