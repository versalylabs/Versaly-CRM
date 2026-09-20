import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { providerRegistry } from '@/lib/communication-providers';

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
            instagram: true,
            facebook: true,
            tiktok: true,
            xHandle: true,
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
            customerSuccess: {
              select: {
                id: true,
                lifecycleStage: true,
                healthScore: true,
                healthStatus: true,
                renewalDate: true,
                renewalValue: true,
                renewalStatus: true,
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
            activityEvents: {
              orderBy: { createdAt: 'desc' },
              take: 6,
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
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

    // Reset unread count when conversation is opened
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
      conversation.unreadCount = 0;
    }

    // Get channel connection status
    const provider = providerRegistry.getProvider(conversation.channel);
    const channelStatus = provider
      ? await provider.getConnectionStatus(organizationId)
      : null;

    return NextResponse.json({
      conversation,
      channelStatus,
    });
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
    const { status, priority, isStarred, isArchived, isClosed, assignedToId, subject } = body;

    // Verify conversation exists and belongs to this organization
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (isStarred !== undefined) data.isStarred = Boolean(isStarred);
    if (isArchived !== undefined) data.isArchived = Boolean(isArchived);
    if (isClosed !== undefined) data.isClosed = Boolean(isClosed);
    if (subject !== undefined) data.subject = subject;

    if (assignedToId !== undefined) {
      if (assignedToId) {
        // Verify assignee belongs to organization
        const user = await prisma.user.findFirst({
          where: { id: assignedToId, organizationId },
        });
        if (!user) {
          return NextResponse.json({ error: 'Assigned user does not belong to your organization' }, { status: 400 });
        }
        data.assignedToId = assignedToId;
      } else {
        data.assignedToId = null;
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/inbox/conversations/[id]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
