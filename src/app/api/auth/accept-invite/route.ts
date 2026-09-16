import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyInviteToken } from '../../../../../lib/invitationToken';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });

  const payload = verifyInviteToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'This invitation link is invalid or has expired' }, { status: 400 });
  }

  // Check if organization still exists and has space
  if (payload.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: payload.organizationId },
      include: { _count: { select: { users: true } } },
    });
    if (!org) return NextResponse.json({ error: 'The inviting workspace no longer exists' }, { status: 404 });
    if (org._count.users >= org.seatLimit) {
      return NextResponse.json(
        { error: 'This workspace has reached its member limit. Please contact the administrator.' },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({
    valid: true,
    email: payload.email,
    role: payload.role,
    organizationName: payload.organizationName,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? '');
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');

    if (!token) return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const payload = verifyInviteToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'This invitation link is invalid or has expired' }, { status: 400 });
    }

    // Check if user already registered
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Check seat capacity
    if (payload.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: payload.organizationId },
        include: { _count: { select: { users: true } } },
      });
      if (!org) return NextResponse.json({ error: 'Workspace no longer exists' }, { status: 404 });
      if (org._count.users >= org.seatLimit) {
        return NextResponse.json(
          { error: 'Workspace seat limit reached. Please contact your workspace administrator.' },
          { status: 403 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: payload.email,
        password: hashedPassword,
        role: payload.role,
        isActive: true,
        organizationId: payload.organizationId || null,
      },
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      message: 'Account created successfully. You can now sign in to your workspace.',
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return NextResponse.json({ error: 'Unable to process invitation' }, { status: 500 });
  }
}
