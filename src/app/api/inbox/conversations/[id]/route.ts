import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
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
            lastContact: true,
            location: true,
            businessType: true,
            notes: true,
            aiInsight: {
              select: {
                sentimentScore: true,
                sentimentLabel: true,
                winProbability: true,
                churnRisk: true,
                buyingSignals: true,
                objections: true,
                suggestedActions: true,
                summaryNotes: true,
              },
            },
            tasks: {
              where: { completed: false },
              orderBy: { dueDate: 'asc' },
              take: 5,
            },
            proposals: {
              orderBy: { createdAt: 'desc' },
              take: 3,
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
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Reset unread count on view
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
      conversation.unreadCount = 0;
    }

    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error('Error in GET /api/inbox/conversations/[id]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;
    const body = await req.json();
    const { status, assignedToId, unreadCount } = body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (unreadCount !== undefined) data.unreadCount = unreadCount;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data,
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/inbox/conversations/[id]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
