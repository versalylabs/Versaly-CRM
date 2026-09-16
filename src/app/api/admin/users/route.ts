import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../lib/subscription';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'AGENT'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (session.user.role !== 'ADMIN') return null;
  return session;
}

function isRole(value: unknown): value is AllowedRole {
  return typeof value === 'string' && ALLOWED_ROLES.includes(value as AllowedRole);
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const orgId = session.user.organizationId;
  const where: any = {};
  if (orgId) {
    where.organizationId = orgId;
  }

  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { assignedLeads: true, assignedTasks: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    orgId
      ? prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true, name: true, plan: true, seatLimit: true },
        })
      : null,
  ]);

  const seatLimit = org?.seatLimit || 10;
  const seatUsed = users.length;

  return NextResponse.json({
    users,
    seatLimit,
    seatUsed,
    plan: org?.plan || 'GROWTH_PRO',
    organizationName: org?.name || 'Workspace',
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role = body.role;
    const orgId = session.user.organizationId;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    if (!isRole(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    // Seat quota enforcement
    if (orgId) {
      const [userCount, org] = await Promise.all([
        prisma.user.count({ where: { organizationId: orgId } }),
        prisma.organization.findUnique({ where: { id: orgId }, select: { seatLimit: true, plan: true } }),
      ]);
      const limit = org?.seatLimit || 10;
      if (userCount >= limit) {
        return NextResponse.json(
          {
            error: `Seat limit reached (${userCount}/${limit} seats used). Please upgrade your subscription plan to add more team members.`,
          },
          { status: 403 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
        organizationId: orgId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { assignedLeads: true, assignedTasks: true } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
