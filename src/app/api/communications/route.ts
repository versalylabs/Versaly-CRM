import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

const COMMUNICATION_TYPES = ['EMAIL', 'WHATSAPP', 'PHONE_CALL', 'SMS', 'LINKEDIN', 'INSTAGRAM', 'OTHER'] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId') || undefined;
  const type = String(searchParams.get('type') || '').trim().toUpperCase();
  const status = String(searchParams.get('status') || '').trim().toUpperCase();
  const limitValue = Number(searchParams.get('limit') || 300);
  const take = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 500) : 300;

  const where: any = {};
  if (leadId) where.leadId = leadId;
  if (type && COMMUNICATION_TYPES.includes(type as any)) where.type = type;
  if (status) where.status = status;

  try {
    const logs = await prisma.outreachLog.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            email: true,
            phone: true,
            nextFollowUp: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take,
    });

    const byType = COMMUNICATION_TYPES.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<string, number>);

    const byStatus: Record<string, number> = {};
    let replied = 0;

    for (const log of logs) {
      byType[log.type] = (byType[log.type] || 0) + 1;
      byStatus[log.status] = (byStatus[log.status] || 0) + 1;
      if (log.status === 'REPLIED') replied += 1;
    }

    return NextResponse.json({
      logs,
      summary: {
        total: logs.length,
        email: byType.EMAIL || 0,
        whatsapp: byType.WHATSAPP || 0,
        replied,
        byType,
        byStatus,
      },
    });
  } catch (error) {
    console.error('Failed to load unified communication history:', error);
    return NextResponse.json({ error: 'Could not load communication history.' }, { status: 500 });
  }
}
