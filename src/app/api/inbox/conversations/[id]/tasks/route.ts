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
    const { title, description, dueDate, priority = 'medium', assignedToId } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const task = await prisma.task.create({
      data: {
        organizationId,
        leadId: conversation.leadId || null,
        title,
        description: description || `Follow-up from conversation: ${conversation.contactName || conversation.subject || 'Inbox chat'}`,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: String(priority).toLowerCase(),
        assignedToId: assignedToId || session.user.id,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations/[id]/tasks:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
