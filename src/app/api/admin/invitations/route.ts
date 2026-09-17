import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';
import { createInviteToken } from '../../../../../lib/invitationToken';
import { sendInviteEmail } from '../../../../../lib/email';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'AGENT'] as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const role = String(body.role ?? 'AGENT');
    const orgId = session.user.organizationId;

    if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(role as any)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.organizationId === orgId) {
        return NextResponse.json({ error: 'This user is already a member of your workspace' }, { status: 409 });
      }
      return NextResponse.json({ error: 'This email is already associated with another account' }, { status: 409 });
    }

    // Check seat capacity
    let orgName = session.user.organizationName || 'Versaly CRM';
    if (orgId) {
      const [userCount, org] = await Promise.all([
        prisma.user.count({ where: { organizationId: orgId } }),
        prisma.organization.findUnique({ where: { id: orgId }, select: { seatLimit: true, name: true, plan: true } }),
      ]);
      const limit = org?.seatLimit || 10;
      if (org?.name) orgName = org.name;

      if (userCount >= limit) {
        return NextResponse.json(
          {
            error: `Seat limit reached (${userCount}/${limit} seats used). Upgrade your plan to invite additional team members.`,
          },
          { status: 403 }
        );
      }
    }

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = createInviteToken({
      organizationId: orgId || '',
      organizationName: orgName,
      email,
      role,
      expiresAt,
    });

    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const inviteUrl = `${proto}://${host}/auth/accept-invite?token=${token}`;

    let emailDelivery = 'not-configured';
    try {
      const delivery = await sendInviteEmail({ to: email, organizationName: orgName, role, inviteUrl, expiresAt: new Date(expiresAt) });
      emailDelivery = delivery.sent ? 'sent' : 'skipped';
    } catch (emailError) {
      console.error('Invite email failed:', emailError);
      emailDelivery = 'failed';
    }

    return NextResponse.json({
      success: true,
      email,
      role,
      token,
      inviteUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      organizationName: orgName,
      emailDelivery,
    });
  } catch (error) {
    console.error('Failed to create invitation:', error);
    return NextResponse.json({ error: 'Failed to generate invitation' }, { status: 500 });
  }
}
