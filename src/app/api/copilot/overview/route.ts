import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { analyzeLeadSentimentAndRisk } from '@/lib/aiCopilot';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch leads with related data for the organization
    const leads = await prisma.lead.findMany({
      where: { organizationId },
      include: {
        tasks: { orderBy: { updatedAt: 'desc' }, take: 20 },
        proposals: { orderBy: { createdAt: 'desc' }, take: 10 },
        activityEvents: { orderBy: { createdAt: 'desc' }, take: 15 },
        aiInsight: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Map each lead to an insight record (use stored or calculate dynamic)
    const enrichedLeads = await Promise.all(
      leads.map(async (lead: any) => {
        let insightData;
        if (lead.aiInsight) {
          insightData = {
            sentimentScore: lead.aiInsight.sentimentScore,
            sentimentLabel: lead.aiInsight.sentimentLabel,
            winProbability: lead.aiInsight.winProbability,
            churnRisk: lead.aiInsight.churnRisk,
            buyingSignals: typeof lead.aiInsight.buyingSignals === 'string'
              ? JSON.parse(lead.aiInsight.buyingSignals)
              : (lead.aiInsight.buyingSignals || []),
            objections: typeof lead.aiInsight.objections === 'string'
              ? JSON.parse(lead.aiInsight.objections)
              : (lead.aiInsight.objections || []),
            suggestedActions: typeof lead.aiInsight.suggestedActions === 'string'
              ? JSON.parse(lead.aiInsight.suggestedActions)
              : (lead.aiInsight.suggestedActions || []),
            summaryNotes: lead.aiInsight.summaryNotes || '',
            analyzedAt: lead.aiInsight.analyzedAt,
          };
        } else {
          // Dynamic calculation if not yet persisted
          const computed = analyzeLeadSentimentAndRisk(lead);
          insightData = {
            ...computed,
            analyzedAt: new Date(),
          };

          // Background upsert for fast subsequent reads
          try {
            await prisma.aiDealInsight.upsert({
              where: { leadId: lead.id },
              update: {
                sentimentScore: computed.sentimentScore,
                sentimentLabel: computed.sentimentLabel,
                winProbability: computed.winProbability,
                churnRisk: computed.churnRisk,
                buyingSignals: JSON.stringify(computed.buyingSignals),
                objections: JSON.stringify(computed.objections),
                suggestedActions: JSON.stringify(computed.suggestedActions),
                summaryNotes: computed.summaryNotes,
                analyzedAt: new Date(),
              },
              create: {
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
              },
            });
          } catch (e) {
            // Non-blocking caching
          }
        }

        return {
          id: lead.id,
          contactName: lead.contactName,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          pipelineStage: lead.pipelineStage,
          outreachStatus: lead.outreachStatus,
          dealValue: lead.dealValue,
          lastContact: lead.lastContact,
          updatedAt: lead.updatedAt,
          insight: insightData,
        };
      })
    );

    // Compute aggregated intelligence metrics
    const totalDeals = enrichedLeads.length;
    let totalWinProb = 0;
    let highIntentCount = 0;
    let atRiskCount = 0;
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      concern: 0,
    };

    enrichedLeads.forEach((item: any) => {
      totalWinProb += item.insight.winProbability;
      if (item.insight.winProbability >= 65 || item.insight.sentimentLabel === 'POSITIVE') {
        highIntentCount += 1;
      }
      if (item.insight.churnRisk === 'HIGH') {
        atRiskCount += 1;
      }
      if (item.insight.sentimentLabel === 'POSITIVE') sentimentCounts.positive += 1;
      else if (item.insight.sentimentLabel === 'CONCERN') sentimentCounts.concern += 1;
      else sentimentCounts.neutral += 1;
    });

    const avgWinProbability = totalDeals > 0 ? Math.round(totalWinProb / totalDeals) : 0;

    // Fetch recent meeting summaries for this organization
    const recentMeetings = await prisma.aiMeetingSummary.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            pipelineStage: true,
          },
        },
      },
    });

    const parsedMeetings = recentMeetings.map((m: any) => ({
      id: m.id,
      leadId: m.leadId,
      lead: m.lead,
      title: m.title,
      summary: m.summary,
      sentiment: m.sentiment,
      actionItems: typeof m.actionItems === 'string' ? JSON.parse(m.actionItems) : (m.actionItems || []),
      objections: typeof m.objections === 'string' ? JSON.parse(m.objections) : (m.objections || []),
      keyDecisions: typeof m.keyDecisions === 'string' ? JSON.parse(m.keyDecisions) : (m.keyDecisions || []),
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      metrics: {
        totalDeals,
        highIntentCount,
        atRiskCount,
        avgWinProbability,
        sentimentCounts,
      },
      leads: enrichedLeads,
      recentMeetings: parsedMeetings,
    });
  } catch (error: any) {
    console.error('Error in GET /api/copilot/overview:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
