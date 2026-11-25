import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { appUrl, createAccountToken, readAccountToken, VERIFY_TTL_MS } from '@/lib/accountTokens';
import { sendVerificationEmail } from '@/lib/email';

/** Confirm an email address from the emailed link: { token }. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = readAccountToken(String(body.token || ''), 'verify');
  if (!token) return NextResponse.json({ error: 'This confirmation link is invalid or has expired.' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: token.userId }, select: { id: true, email: true } });
  // The link is only valid for the address it was sent to.
  if (!user || user.email !== token.stamp) return NextResponse.json({ error: 'This confirmation link is no longer valid.' }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return NextResponse.json({ success: true });
}

/** Resend the confirmation email to the signed-in user. */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, emailVerified: true } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ success: true, alreadyVerified: true });
  const token = createAccountToken('verify', user.id, user.email, VERIFY_TTL_MS);
  const result = await sendVerificationEmail({
    to: user.email,
    name: user.name || 'there',
    verifyUrl: `${appUrl(req.nextUrl.origin)}/auth/verify-email?token=${encodeURIComponent(token)}`,
  });
  if (!result.sent) return NextResponse.json({ error: 'We could not send the email right now. Please try again later.' }, { status: 503 });
  return NextResponse.json({ success: true });
}
