import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { passwordStamp, readAccountToken } from '@/lib/accountTokens';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';

const invalid = () => NextResponse.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
  }

  const token = readAccountToken(String(body.token || ''), 'reset');
  if (!token) return invalid();
  const user = await prisma.user.findUnique({ where: { id: token.userId }, select: { id: true, password: true, isActive: true } });
  // The stamp must match the current password, so each link works once.
  if (!user || !user.isActive || !user.password || passwordStamp(user.password) !== token.stamp) return invalid();

  // Following the emailed link proves the address, so it also counts as verification.
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(password, 12), emailVerified: new Date() },
  });
  return NextResponse.json({ success: true });
}
