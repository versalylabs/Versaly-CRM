import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAiOutreachDraft, analyzeLeadSentimentAndRisk } from '@/lib/aiCopilot';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      leadId,
      channel = 'EMAIL',
      tone = 'PROFESSIONAL',
      objective = 'FOLLOW_UP',
      customNotes = '',
    } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        aiInsight: true,
        tasks: { orderBy: { updatedAt: 'desc' }, take: 10 },
        proposals: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let insight = lead.aiInsight;
    if (!insight) {
      const computed = analyzeLeadSentimentAndRisk(lead);
      insight = {
        id: 'computed',
        organizationId,
        leadId: lead.id,
        sentimentScore: computed.sentimentScore,
        sentimentLabel: computed.sentimentLabel,
        winProbability: computed.winProbability,
        churnRisk: computed.churnRisk,
        buyingSignals: JSON.stringify(computed.buyingSignals),
        objections: JSON.stringify(computed.objections),
        suggestedActions: JSON.stringify(computed.suggestedActions),
        summaryNotes: computed.summaryNotes,
        analyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const senderName = session.user?.name || 'Account Executive';

    const draft = generateAiOutreachDraft({
      lead,
      insight,
      channel,
      tone,
      objective,
      customNotes,
      senderName,
    });

    return NextResponse.json({
      success: true,
      draft,
      lead: {
        id: lead.id,
        contactName: lead.contactName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/copilot/draft:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
