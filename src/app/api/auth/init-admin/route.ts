import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let org = await prisma.organization.findFirst({
      where: { slug: 'versaly-ht' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Versaly Labs',
          slug: 'versaly-hq',
          plan: 'GROWTH_PRM',
          planStatus: 'active',
          leadLimit: 5000,
          seatLimit: 10,
          currency: 'KES',
        },
      });
    }

    const versalyHashedPassword = await bcrypt.hash('labversaly-16', 10);
    const demoHashedPassword = await bcrypt.hash('password123', 10);

    const existingVersaly = await prisma.user.findUnique({
      where: { email: 'versalylabs@gmail.com' },
    });

    if (!existingVersaly) {
      await prisma.user.create({
        data: {
          name: 'Versaly Admin',
          email: 'versalylabs@gmail.com',
          password: versalyHashedPassword,
          role: 'ADMIN',
          isActive: true,
          organizationId: org.id,
        },
      });
    } else {
      await prisma.user.update({
        where: { email: 'versalylabs@gmail.com' },
        data: {
          password: versalyHashedPassword,
          isActive: true,
          role: 'ADMIN',
          organizationId: existingVersaly.organizationId || org.id,
        },
      });
    }

    const existingDemo = await prisma.user.findUnique({
      where: { email: 'demo@versaly.com' },
    });

    if (!existingDemo) {
      await prisma.user.create({
        data: {
          name: 'Demo Admin',
          email: 'demo@versaly.com',
          password: demoHashedPassword,
          role: 'ADMIN',
          isActive: true,
          organizationId: org.id,
        },
      });
    } else {
      await prisma.user.update({
        where: { email: 'demo@versaly.com' },
        data: {
          password: demoHashedPassword,
          isActive: true,
          role: 'ADMIN',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Admin accounts synchronized successfully',
      users: ['versalylabs@gmail.com', 'demo@versaly.com'],
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
