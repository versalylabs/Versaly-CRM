import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { initializeWorkspaceOnboarding } from '../../../../../lib/onboarding';
import { sendWelcomeEmail } from '../../../../../lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, companyName, password, currency, plan: rawPlan } = body;
    const plan: 'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE' =
      rawPlan === 'STARTER' || rawPlan === 'ENTERPRISE' ? rawPlan : 'GROWTH_PRO';
    const planLimitsMap: Record<'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE', { leadLimit: number; seatLimit: number; automationRunLimit: number }> = {
      STARTER: { leadLimit: 1000, seatLimit: 3, automationRunLimit: 100 },
      GROWTH_PRO: { leadLimit: 5000, seatLimit: 10, automationRunLimit: 1000 },
      ENTERPRISE: { leadLimit: 100000, seatLimit: 50, automationRunLimit: 10000 },
    };
    const planLimits = planLimitsMap[plan];

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

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
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
          currency: currency && typeof currency === 'string' ? currency.toUpperCase() : 'USD',
        },
      });

      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      await initializeWorkspaceOnboarding(tx, {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        userId: user.id,
        currency: organization.currency,
      });

      return { organization, user };
    });

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
        onboarding: { sampleLeads: 3, checklistTasks: 5, welcomeEmail },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);    return NextResponse.json(
      { error: 'An unexpected error occurred while creating your workspace. Please try again.' },
      { status: 500 }
    );
  }
}
