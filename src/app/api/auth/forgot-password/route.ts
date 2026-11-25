import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { appUrl, createAccountToken, passwordStamp } from '@/lib/accountTokens';
import { sendPasswordResetEmail } from '@/lib/email';

const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  // Same answer whether or not the account exists, so this can't be used to discover emails.
  const reply = NextResponse.json({ success: true, message: 'If an account exists for that email, we have sent a link to reset the password.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return reply;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, password: true, isActive: true } });
  if (!user || !user.isActive || !user.password) return reply;

  const token = createAccountToken('reset', user.id, passwordStamp(user.password), RESET_TTL_MS);
  try {
    const result = await sendPasswordResetEmail({
      to: email,
      name: user.name || 'there',
      resetUrl: `${appUrl(req.nextUrl.origin)}/auth/reset-password?token=${encodeURIComponent(token)}`,
    });
    if (!result.sent) console.error('Password reset email not sent:', result.reason);
  } catch (error) {
    console.error('Password reset email failed', error);
  }
  return reply;
}
