import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export function getPlatformAdminEmails() {
  const configured = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  // Only the workspace owner is trusted by default. Never add demo/test accounts here.
  const defaults = ['versalylabs@gmail.com'];
  return Array.from(new Set([...defaults, ...configured]));
}

export async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !getPlatformAdminEmails().includes(email)) {
    return { session, authorized: false } as const;
  }
  return { session, authorized: true } as const;
}
