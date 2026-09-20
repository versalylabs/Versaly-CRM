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
    const body = await req.json().catch(() => ({}));

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.leadId) {
      const existingLead = await prisma.lead.findUnique({
        where: { id: conversation.leadId },
      });
      return NextResponse.json({ success: true, lead: existingLead, message: 'Conversation is already linked to a lead' });
    }

    const contactName = body.contactName || conversation.contactName || 'New Prospect';
    const email = body.email || conversation.contactEmail || `lead_${Date.now()}@inbound.crm`;
    const companyName = body.companyName || null;
    const phone = body.phone || conversation.contactPhone || null;

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        contactName,
        companyName,
        email,
        phone,
        instagram: conversation.channel === 'INSTAGRAM' ? conversation.contactHandle : body.instagram || null,
        facebook: conversation.channel === 'FACEBOOK' ? conversation.contactHandle : body.facebook || null,
        tiktok: conversation.channel === 'TIKTOK' ? conversation.contactHandle : body.tiktok || null,
        xHandle: conversation.channel === 'X' ? conversation.contactHandle : body.xHandle || null,
        leadSource: 'SOCIAL_MEDIA',
        pipelineStage: 'NEW_LEAD',
        outreachStatus: 'REPLIED',
        notes: `Converted from Unified Inbox conversation (${conversation.channel})`,
        assignedToId: session.user.id,
      },
    });

    // Update conversation with new leadId
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        leadId: lead.id,
        contactName: lead.contactName,
        contactEmail: lead.email,
        contactPhone: lead.phone,
      },
      include: {
        lead: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, lead, conversation: updatedConversation });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/conversations/[id]/convert-lead:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
