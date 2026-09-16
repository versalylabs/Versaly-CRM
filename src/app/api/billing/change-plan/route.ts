import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Only workspace administrators can manage billing and plans.' },
      { status: 403 }
    );
  }

  try {
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { plan } = await req.json();

    const planLimits: Record<string, { leadLimit: number; seatLimit: number; automationRunLimit: number; name: string }> = {
      STARTER: { leadLimit: 150, seatLimit: 3, automationRunLimit: 100, name: 'Starter Tier' },
      GROWTH_PRO: { leadLimit: 500, seatLimit: 10, automationRunLimit: 1000, name: 'Growth Pro' },
      ENTERPRISE: { leadLimit: 100000, seatLimit: 50, automationRunLimit: 10000, name: 'Enterprise Scale' },
    };

    const targetConfig = planLimits[plan];
    if (!targetConfig) {
      return NextResponse.json(
        { error: 'Invalid plan selected. Must be STARTER, GROWTH_PRO, or ENTERPRISE.' },
        { status: 400 }
      );
    }

    // Update organization plan in database
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        planStatus: 'active',
        leadLimit: targetConfig.leadLimit,
        seatLimit: targetConfig.seatLimit,
        automationRunLimit: targetConfig.automationRunLimit,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully switched to ${targetConfig.name}!`,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        plan: updatedOrg.plan,
        planStatus: updatedOrg.planStatus,
        leadLimit: updatedOrg.leadLimit,
        seatLimit: updatedOrg.seatLimit,
      },
    });
  } catch (error) {
    console.error('Failed to change plan:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating your plan.' },
      { status: 500 }
    );
  }
}
