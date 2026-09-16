import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../../../lib/subscription';
import prisma from '../../../../../../lib/prisma';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'AGENT'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null;
  return session;
}

function isRole(value: unknown): value is AllowedRole {
  return typeof value === 'string' && ALLOWED_ROLES.includes(value as AllowedRole);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, organizationId: true } });
    if (!target || (session.user.organizationId && target.organizationId && target.organizationId !== session.user.organizationId)) {
      return NextResponse.json({ error: 'User not found in your workspace' }, { status: 404 });
    }

    const data: { name?: string; email?: string; role?: AllowedRole; isActive?: boolean; password?: string } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
      data.email = email;
    }
    if (body.role !== undefined) {
      if (!isRole(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      if (params.id === session.user.id && body.role !== 'ADMIN') {
        return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 });
      }
      data.role = body.role;
    }
    if (body.isActive !== undefined) {
      const isActive = Boolean(body.isActive);
      if (params.id === session.user.id && !isActive) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
      }
      data.isActive = isActive;
    }
    if (body.password !== undefined && body.password !== '') {
      const password = String(body.password);
      if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      data.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (params.id === session.user.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });

  try {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, organizationId: true } });
    if (!target || (session.user.organizationId && target.organizationId && target.organizationId !== session.user.organizationId)) {
      return NextResponse.json({ error: 'User not found in your workspace' }, { status: 404 });
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
