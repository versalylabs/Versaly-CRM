import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendUnifiedMessage } from '@/lib/inbox';

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

    // Verify conversation belongs to tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error in GET /api/inbox/conversations/[id]/messages:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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
    const { channel = 'EMAIL', content, subject, isInternal = false, attachments, metadata } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const senderName = session.user?.name || 'Account Executive';
    const senderId = session.user?.id;

    const result = await sendUnifiedMessage({
      organizationId,
      conversationId,
      senderId,
      senderName,
      channel,
      content: content.trim(),
      subject,
      isInternal,
      attachments,
      metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.errorMessage || `Failed to send message via ${channel}`,
          requiresConnection: result.requiresConnection,
          deliveryStatus: result.deliveryStatus,
        },
        { status: result.requiresConnection ? 400 : 502 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations/[id]/messages:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
