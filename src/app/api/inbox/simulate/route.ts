import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { simulateInboundMessage } from '@/lib/inbox';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, content, channel = 'WHATSAPP' } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 });
    }

    const message = await simulateInboundMessage({
      conversationId,
      content,
      channel,
    });

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/simulate:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
