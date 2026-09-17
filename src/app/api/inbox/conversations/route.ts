import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateLeadConversation } from '@/lib/inbox';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const channel = searchParams.get('channel') || 'all';
    const query = searchParams.get('query') || '';
    const assigned = searchParams.get('assigned') || 'all';

    const where: any = { organizationId };

    if (status !== 'all') {
      where.status = status;
    }

    if (channel !== 'all') {
      where.channel = channel;
    }

    if (assigned === 'me') {
      where.assignedToId = session.user.id;
    } else if (assigned === 'unassigned') {
      where.assignedToId = null;
    }

    if (query.trim()) {
      where.OR = [
        { lead: { contactName: { contains: query } } },
        { lead: { companyName: { contains: query } } },
        { lead: { email: { contains: query } } },
        { lastMessageSnippet: { contains: query } },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            email: true,
            phone: true,
            pipelineStage: true,
            outreachStatus: true,
            dealValue: true,
            aiInsight: {
              select: {
                sentimentScore: true,
                sentimentLabel: true,
                winProbability: true,
                churnRisk: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });

    // Compute folder counters
    const [allCount, unreadCount, openCount, waitingCustomerCount, closedCount] = await Promise.all([
      prisma.conversation.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId, unreadCount: { gt: 0 } } }),
      prisma.conversation.count({ where: { organizationId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { organizationId, status: 'WAITING_ON_CUSTOMER' } }),
      prisma.conversation.count({ where: { organizationId, status: 'CLOSED' } }),
    ]);

    return NextResponse.json({
      conversations,
      counts: {
        all: allCount,
        unread: unreadCount,
        open: openCount,
        waiting: waitingCustomerCount,
        closed: closedCount,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/inbox/conversations:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadId, channel = 'EMAIL', subject } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const conversation = await getOrCreateLeadConversation({
      organizationId,
      leadId,
      channel,
      subject,
      assignedToId: session.user.id,
    });

    return NextResponse.json({ success: true, conversation });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
