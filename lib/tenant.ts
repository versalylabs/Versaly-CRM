import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';

export type OrgContext = {
  userId: string;
  orgId: string;
  role: string;
  email: string | null;
};

/**
 * Returns the authenticated user's workspace context, or null when the caller
 * is not signed in or has no workspace. EVERY tenant-owned query must be
 * filtered by `orgId` from this context — never from request input.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.organizationId) return null;
  return { userId: user.id, orgId: user.organizationId, role: user.role || 'AGENT', email: user.email || null };
}

export const isManagerRole = (role?: string | null) => role === 'ADMIN' || role === 'MANAGER';

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
