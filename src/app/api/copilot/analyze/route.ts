import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { analyzeLeadSentimentAndRisk } from '@/lib/aiCopilot';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadId } = body;
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    // Verify lead ownership
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        tasks: { orderBy: { updatedAt: 'desc' }, take: 20 },
        proposals: { orderBy: { createdAt: 'desc' }, take: 10 },
        activityEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Run AI analysis
    const analysis = analyzeLeadSentimentAndRisk(lead);

    // Persist to database
    const savedInsight = await prisma.aiDealInsight.upsert({
      where: { leadId },
      update: {
        sentimentScore: analysis.sentimentScore,
        sentimentLabel: analysis.sentimentLabel,
        winProbability: analysis.winProbability,
        churnRisk: analysis.churnRisk,
        buyingSignals: JSON.stringify(analysis.buyingSignals),
        objections: JSON.stringify(analysis.objections),
        suggestedActions: JSON.stringify(analysis.suggestedActions),
        summaryNotes: analysis.summaryNotes,
        analyzedAt: new Date(),
      },
      create: {
        organizationId,
        leadId,
        sentimentScore: analysis.sentimentScore,
        sentimentLabel: analysis.sentimentLabel,
        winProbability: analysis.winProbability,
        churnRisk: analysis.churnRisk,
        buyingSignals: JSON.stringify(analysis.buyingSignals),
        objections: JSON.stringify(analysis.objections),
        suggestedActions: JSON.stringify(analysis.suggestedActions),
        summaryNotes: analysis.summaryNotes,
      },
    });

    // Record activity event
    try {
      await prisma.activityEvent.create({
        data: {
          leadId,
          type: 'AI_ANALYSIS_REFRESHED',
          action: `AI Copilot refreshed deal intelligence: ${analysis.sentimentLabel} sentiment (${analysis.sentimentScore}%), ${analysis.winProbability}% win probability, ${analysis.churnRisk} churn risk.`,
        },
      });
    } catch (e) {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      insight: {
        id: savedInsight.id,
        leadId: savedInsight.leadId,
        sentimentScore: savedInsight.sentimentScore,
        sentimentLabel: savedInsight.sentimentLabel,
        winProbability: savedInsight.winProbability,
        churnRisk: savedInsight.churnRisk,
        buyingSignals: analysis.buyingSignals,
        objections: analysis.objections,
        suggestedActions: analysis.suggestedActions,
        summaryNotes: savedInsight.summaryNotes,
        analyzedAt: savedInsight.analyzedAt,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/copilot/analyze:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
