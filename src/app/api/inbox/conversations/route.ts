import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateConversation } from '@/lib/inbox';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'all';
    const channel = searchParams.get('channel') || 'all';
    const priority = searchParams.get('priority') || 'all';
    const query = searchParams.get('query') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '40', 10)));
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    // Apply Folder filter
    switch (folder) {
      case 'unread':
        where.unreadCount = { gt: 0 };
        where.isArchived = false;
        where.isClosed = false;
        break;
      case 'assigned_to_me':
        where.assignedToId = session.user.id;
        where.isArchived = false;
        where.isClosed = false;
        break;
      case 'unassigned':
        where.assignedToId = null;
        where.isArchived = false;
        where.isClosed = false;
        break;
      case 'starred':
        where.isStarred = true;
        break;
      case 'archived':
        where.isArchived = true;
        break;
      case 'closed':
        where.OR = [{ status: 'CLOSED' }, { isClosed: true }];
        break;
      case 'all':
      default:
        // By default, hide archived conversations in "all" unless explicitly requested
        where.isArchived = false;
        break;
    }

    // Channel filter
    if (channel !== 'all') {
      where.channel = channel.toUpperCase();
    }

    // Priority filter
    if (priority !== 'all') {
      where.priority = priority.toUpperCase();
    }

    // Search query
    if (query.trim()) {
      where.AND = [
        {
          OR: [
            { contactName: { contains: query, mode: 'insensitive' } },
            { contactEmail: { contains: query, mode: 'insensitive' } },
            { contactPhone: { contains: query } },
            { contactHandle: { contains: query, mode: 'insensitive' } },
            { subject: { contains: query, mode: 'insensitive' } },
            { lastMessageSnippet: { contains: query, mode: 'insensitive' } },
            { lead: { contactName: { contains: query, mode: 'insensitive' } } },
            { lead: { companyName: { contains: query, mode: 'insensitive' } } },
            { lead: { email: { contains: query, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              contactName: true,
              companyName: true,
              email: true,
              phone: true,
              instagram: true,
              facebook: true,
              tiktok: true,
              xHandle: true,
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
              customerSuccess: {
                select: {
                  lifecycleStage: true,
                  healthScore: true,
                  healthStatus: true,
                  renewalDate: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Compute folder counters accurately across the tenant workspace
    const [allCount, unreadCount, assignedMeCount, unassignedCount, starredCount, archivedCount, closedCount] =
      await Promise.all([
        prisma.conversation.count({ where: { organizationId, isArchived: false } }),
        prisma.conversation.count({ where: { organizationId, unreadCount: { gt: 0 }, isArchived: false } }),
        prisma.conversation.count({ where: { organizationId, assignedToId: session.user.id, isArchived: false } }),
        prisma.conversation.count({ where: { organizationId, assignedToId: null, isArchived: false } }),
        prisma.conversation.count({ where: { organizationId, isStarred: true } }),
        prisma.conversation.count({ where: { organizationId, isArchived: true } }),
        prisma.conversation.count({ where: { organizationId, OR: [{ status: 'CLOSED' }, { isClosed: true }] } }),
      ]);

    return NextResponse.json({
      conversations,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      counts: {
        all: allCount,
        unread: unreadCount,
        assignedToMe: assignedMeCount,
        unassigned: unassignedCount,
        starred: starredCount,
        archived: archivedCount,
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
    const { leadId, channel = 'EMAIL', subject, contactName, contactEmail, contactPhone, contactHandle } = body;

    const conversation = await getOrCreateConversation({
      organizationId,
      leadId: leadId || undefined,
      contactName,
      contactEmail,
      contactPhone,
      contactHandle,
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
