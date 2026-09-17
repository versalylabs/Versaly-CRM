import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendUnifiedMessage } from '@/lib/inbox';

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
    const { channel = 'EMAIL', content, subject, isInternal = false } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const senderName = session.user?.name || 'Account Executive';
    const senderId = session.user?.id;

    const result = await sendUnifiedMessage({
      conversationId,
      senderId,
      senderName,
      channel,
      content,
      subject,
      isInternal,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations/[id]/messages:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
