import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSmartReplySuggestions } from '@/lib/inbox';

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
      where: { id: conversationId, organizationId },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            pipelineStage: true,
            dealValue: true,
            aiInsight: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const lastMessage = conversation.messages[0]?.content || '';
    const suggestions = generateSmartReplySuggestions(conversation.lead, lastMessage);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error in GET /api/inbox/conversations/[id]/smart-replies:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
