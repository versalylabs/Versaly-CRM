import { NextRequest, NextResponse } from 'next/server';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { initializeWorkspaceOnboarding } from '../../../../../lib/onboarding';
import { sendWelcomeEmail } from '../../../../../lib/email';
import { createAccountToken, VERIFY_TTL_MS } from '../../../../../lib/accountTokens';
import { PLAN_LIMITS, normalizePlan } from '../../../../../lib/plans';
import { normalizePhone } from '../../../../../lib/phone';
import { applyIndustryTemplate } from '../../../../../lib/industryTemplates';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, companyName, password, currency, plan: rawPlan, industry } = body;
    const phone = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !phone) {
      return NextResponse.json({ error: 'Enter a valid phone number, for example 0712 345 678' }, { status: 400 });
    }
    const plan = normalizePlan(rawPlan);
    const planLimits = PLAN_LIMITS[plan];

    // 1. Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return NextResponse.json({ error: 'Company or workspace name is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // 3. Generate unique organization slug
    let baseSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    if (!baseSlug) baseSlug = 'workspace';

    let slug = baseSlug;
    let count = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create Organization, Admin User, and Welcome Task in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: companyName.trim(),
          slug,
          plan,
          planStatus: 'trialing',
          leadLimit: planLimits.leadLimit,
          seatLimit: planLimits.seatLimit,
          automationRunLimit: planLimits.automationRunLimit,
          currency: currency && typeof currency === 'string' ? currency.toUpperCase() : 'KES',
        },
      });

      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          password: hashedPassword,
          phone,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      if (industry) await applyIndustryTemplate(tx, organization.id, String(industry));

      await initializeWorkspaceOnboarding(tx, {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        userId: user.id,
        currency: organization.currency,
      });

      return { organization, user };
    }, { maxWait: 10000, timeout: 20000 }); // signup does several writes; allow for slower databases

    // Email delivery is intentionally outside the transaction: a temporary SMTP failure must never roll back a paid/trial signup.
    const appUrl = (process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, '');
    let welcomeEmail = 'not-configured';
    try {
      const emailResult = await sendWelcomeEmail({
        to: result.user.email,
        name: result.user.name || 'there',
        organizationName: result.organization.name,
        plan: result.organization.plan,
        loginUrl: `${appUrl}/`,
        verifyUrl: `${appUrl}/auth/verify-email?token=${encodeURIComponent(createAccountToken('verify', result.user.id, result.user.email, VERIFY_TTL_MS))}`,
      });
      welcomeEmail = emailResult.sent ? 'sent' : 'skipped';
    } catch (emailError) {
      console.error('Welcome email failed after successful registration:', emailError);
      welcomeEmail = 'failed';
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Workspace and account created successfully',
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
          plan: result.organization.plan,
        },
        onboarding: { checklistTasks: 5, welcomeEmail },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    // Never show database internals to the visitor; details are in the server log above.
    return NextResponse.json(
      { error: 'We could not create your workspace just now. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
