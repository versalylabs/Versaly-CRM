import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const { assignedToId } = body;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let targetUser: any = null;
    if (assignedToId) {
      targetUser = await prisma.user.findFirst({
        where: { id: assignedToId, organizationId },
        select: { id: true, name: true, email: true },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: 'Assigned user does not belong to your organization' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId: assignedToId || null,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Create in-app notification for the newly assigned user (if not self-assign)
    if (targetUser && targetUser.id !== session.user.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: targetUser.id,
            type: 'CONVERSATION_ASSIGNED',
            title: 'New conversation assigned to you',
            message: `${session.user.name || 'A team member'} assigned you a conversation with ${conversation.contactName || 'a customer'}.`,
            href: `/inbox?conversationId=${conversation.id}`,
          },
        });
      } catch (e) {
        // Non-blocking notification
      }
    }

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations/[id]/assign:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
