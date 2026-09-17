import prisma from './prisma';

export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'CONCERN';
export type ChurnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SuggestedAction {
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timeframe: string;
  channel?: 'EMAIL' | 'WHATSAPP' | 'CALL' | 'TASK';
}

export interface AiAnalysisResult {
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  winProbability: number;
  churnRisk: ChurnRiskLevel;
  buyingSignals: string[];
  objections: string[];
  suggestedActions: SuggestedAction[];
  summaryNotes: string;
}

export interface MeetingSummaryResult {
  title: string;
  summary: string;
  actionItems: {
    title: string;
    dueDate?: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  objections: {
    objection: string;
    counterStrategy: string;
  }[];
  keyDecisions: string[];
  sentiment: SentimentLabel;
}

export interface OutreachDraftResult {
  subject: string;
  content: string;
  channel: 'EMAIL' | 'WHATSAPP';
}

function daysBetween(d1: Date, d2: Date = new Date()): number {
  return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Heuristic NLP and algorithmic evaluation of lead data for sentiment,
 * predictive win probability, churn risk, buying signals, and objections.
 */
export function analyzeLeadSentimentAndRisk(lead: any): AiAnalysisResult {
  let sentimentScore = 55;
  let winProbability = 40;
  const buyingSignals: string[] = [];
  const objections: string[] = [];
  const suggestedActions: SuggestedAction[] = [];

  const daysSinceContact = lead.lastContact ? daysBetween(new Date(lead.lastContact)) : 999;
  const daysSinceCreated = lead.createdAt ? daysBetween(new Date(lead.createdAt)) : 0;
  const overdueTasks = (lead.tasks || []).filter(
    (t: any) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
  ).length;
  const completedTasks = (lead.tasks || []).filter((t: any) => t.completed).length;
  const acceptedProposals = (lead.proposals || []).filter((p: any) => p.status === 'accepted').length;
  const sentProposals = (lead.proposals || []).filter((p: any) => p.status === 'sent').length;
  const rejectedProposals = (lead.proposals || []).filter((p: any) => p.status === 'rejected').length;

  // Pipeline stage calibration
  switch (lead.pipelineStage) {
    case 'NEW_LEAD':
      winProbability = 15;
      break;
    case 'RESEARCHING':
      winProbability = 25;
      break;
    case 'CONTACTED':
      winProbability = 35;
      break;
    case 'FOLLOW_UP':
      winProbability = 50;
      break;
    case 'INTERESTED':
      winProbability = 68;
      sentimentScore += 15;
      buyingSignals.push('Expressed verified interest during qualification stage');
      break;
    case 'PROPOSAL':
      winProbability = 80;
      sentimentScore += 20;
      buyingSignals.push('Active formal proposal under commercial evaluation');
      break;
    case 'WON':
      winProbability = 100;
      sentimentScore = 95;
      buyingSignals.push('Deal closed won; high retention potential');
      break;
    case 'LOST':
      winProbability = 5;
      sentimentScore = 20;
      objections.push('Deal archived as lost');
      break;
    default:
      break;
  }

  // Outreach engagement factors
  if (lead.outreachStatus === 'REPLIED') {
    sentimentScore += 15;
    winProbability += 10;
    buyingSignals.push('Prospect engaged directly via reply to recent outreach');
  } else if (lead.outreachStatus === 'CLICKED' || lead.outreachStatus === 'OPENED') {
    sentimentScore += 5;
    winProbability += 5;
    buyingSignals.push('Prospect actively opens and inspects shared collateral');
  } else if (lead.outreachStatus === 'BOUNCED') {
    sentimentScore -= 20;
    winProbability -= 15;
    objections.push('Email communication bounced or invalid contact channel');
    suggestedActions.push({
      action: 'Verify alternative contact channel (phone / LinkedIn / WhatsApp)',
      priority: 'HIGH',
      timeframe: 'Within 24 hours',
      channel: 'WHATSAPP',
    });
  }

  // Recency & Velocity factors
  if (daysSinceContact <= 3) {
    sentimentScore += 8;
    winProbability += 5;
    buyingSignals.push('Recent touchpoint recorded within last 72 hours');
  } else if (daysSinceContact > 30) {
    sentimentScore -= 15;
    winProbability -= 20;
    objections.push(`Severe inactivity: ${daysSinceContact} days since last recorded contact`);
    suggestedActions.push({
      action: 'Execute re-engagement sequence with value-add market insight',
      priority: 'HIGH',
      timeframe: 'Immediate',
      channel: 'EMAIL',
    });
  } else if (daysSinceContact > 14) {
    sentimentScore -= 8;
    winProbability -= 10;
    objections.push(`Communication gap: ${daysSinceContact} days without contact`);
    suggestedActions.push({
      action: 'Schedule check-in follow-up to maintain deal momentum',
      priority: 'MEDIUM',
      timeframe: 'Next 48 hours',
      channel: 'CALL',
    });
  }

  // Tasks & Commitments
  if (overdueTasks > 0) {
    sentimentScore -= Math.min(20, overdueTasks * 6);
    winProbability -= Math.min(15, overdueTasks * 5);
    objections.push(`${overdueTasks} pending task${overdueTasks > 1 ? 's are' : ' is'} past due date`);
    suggestedActions.push({
      action: `Resolve ${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''} to restore rep accountability`,
      priority: 'HIGH',
      timeframe: 'Today',
      channel: 'TASK',
    });
  }

  if (completedTasks > 2) {
    winProbability += 8;
    buyingSignals.push(`Strong rep follow-through: ${completedTasks} action items resolved`);
  }

  // Proposals
  if (acceptedProposals > 0) {
    winProbability = Math.max(90, winProbability + 25);
    buyingSignals.push('Proposal formally approved by decision maker');
  } else if (sentProposals > 0) {
    winProbability += 12;
    buyingSignals.push('Commercial quote delivered; awaiting signature');
    suggestedActions.push({
      action: 'Send polite executive reminder on outstanding proposal terms',
      priority: 'MEDIUM',
      timeframe: 'Within 3 days',
      channel: 'EMAIL',
    });
  } else if (rejectedProposals > 0) {
    sentimentScore -= 20;
    winProbability -= 25;
    objections.push('Previous proposal terms rejected or negotiated down');
    suggestedActions.push({
      action: 'Conduct objection diagnosis call to assess pricing or scope misalignment',
      priority: 'HIGH',
      timeframe: 'This week',
      channel: 'CALL',
    });
  }

  // Deal Value & Valuation
  if (lead.dealValue && lead.dealValue > 50000) {
    buyingSignals.push('Enterprise-scale deal size flagged for high-touch priority');
  }

  // Default actions if list is empty
  if (suggestedActions.length === 0) {
    if (lead.pipelineStage === 'WON') {
      suggestedActions.push({
        action: 'Transition account to Customer Success onboarding sequence',
        priority: 'MEDIUM',
        timeframe: 'Within 7 days',
      });
    } else {
      suggestedActions.push({
        action: 'Conduct quick progress touchpoint to lock in next milestone',
        priority: 'MEDIUM',
        timeframe: 'Next 5 business days',
        channel: 'EMAIL',
      });
    }
  }

  // Final bounds
  sentimentScore = Math.max(5, Math.min(98, sentimentScore));
  winProbability = Math.max(5, Math.min(98, winProbability));

  const sentimentLabel: SentimentLabel =
    sentimentScore >= 68 ? 'POSITIVE' : sentimentScore >= 42 ? 'NEUTRAL' : 'CONCERN';

  let churnRisk: ChurnRiskLevel = 'LOW';
  if (winProbability < 35 || sentimentScore < 40 || overdueTasks >= 2 || daysSinceContact > 25) {
    churnRisk = 'HIGH';
  } else if (winProbability < 60 || sentimentScore < 60 || daysSinceContact > 14) {
    churnRisk = 'MEDIUM';
  }

  // Summary generation
  const contactName = lead.contactName || 'The prospect';
  const companyName = lead.companyName ? `at ${lead.companyName}` : '';
  const summaryNotes = `${contactName} ${companyName} displays ${sentimentLabel.toLowerCase()} engagement with a calculated ${winProbability}% win probability. ${
    churnRisk === 'HIGH'
      ? 'Attention required: Elevated churn risk due to delayed touchpoints or friction.'
      : churnRisk === 'MEDIUM'
      ? 'Healthy baseline velocity with actionable follow-up opportunities.'
      : 'Strong pipeline momentum and favorable buying trajectory.'
  }`;

  return {
    sentimentScore,
    sentimentLabel,
    winProbability,
    churnRisk,
    buyingSignals,
    objections,
    suggestedActions,
    summaryNotes,
  };
}

/**
 * Intelligent meeting transcript and call note parser.
 * Extracts key takeaways, action items, objections, and sentiment.
 */
export function summarizeMeetingTranscript(
  text: string,
  leadContext?: { contactName?: string; companyName?: string; dealValue?: number | null }
): MeetingSummaryResult {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Sentiment detection based on keywords
  const positiveWords = ['excited', 'budget approved', 'love', 'move forward', 'sign', 'agree', 'great', 'timeline works', 'deal', 'partnership', 'send invoice'];
  const objectionWords = ['too expensive', 'budget concern', 'competitor', 'not now', 'hesitant', 'delay', 'push back', 'cheaper', 'missing feature', 'review with boss', 'uncertain'];

  let positiveScore = 0;
  let objectionScore = 0;

  positiveWords.forEach((w) => {
    if (lower.includes(w)) positiveScore += 1;
  });
  objectionWords.forEach((w) => {
    if (lower.includes(w)) objectionScore += 1;
  });

  const sentiment: SentimentLabel =
    positiveScore > objectionScore
      ? 'POSITIVE'
      : objectionScore > positiveScore
      ? 'CONCERN'
      : 'NEUTRAL';

  // Objections extraction
  const objections: { objection: string; counterStrategy: string }[] = [];
  if (lower.includes('expensive') || lower.includes('cost') || lower.includes('budget')) {
    objections.push({
      objection: 'Budget & Pricing Hesitation',
      counterStrategy: 'Highlight ROI, flexible payment milestone options, or calculate annual cost-savings vs. current manual processes.',
    });
  }
  if (lower.includes('competitor') || lower.includes('evaluating other') || lower.includes('alternative')) {
    objections.push({
      objection: 'Competitive Vendor Evaluation',
      counterStrategy: 'Focus on unique implementation speed, dedicated onboarding support, and native workflow automation.',
    });
  }
  if (lower.includes('timeline') || lower.includes('next quarter') || lower.includes('delay') || lower.includes('later')) {
    objections.push({
      objection: 'Implementation Delay / Not Right Now',
      counterStrategy: 'Propose phased rollout or pilot cohort to lock in current pricing with zero initial workflow disruption.',
    });
  }
  if (lower.includes('feature') || lower.includes('integration') || lower.includes('missing')) {
    objections.push({
      objection: 'Capability or Integration Requirement',
      counterStrategy: 'Showcase webhooks/REST API capabilities or clarify existing native integration pathways.',
    });
  }

  // Key decisions extraction
  const keyDecisions: string[] = [];
  if (lower.includes('agreed') || lower.includes('decided') || lower.includes('confirmed')) {
    const sentences = clean.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
    const matches = sentences.filter((s) => {
      const sl = s.toLowerCase();
      return sl.includes('agreed') || sl.includes('confirmed') || sl.includes('decided') || sl.includes('will');
    });
    matches.slice(0, 3).forEach((m) => keyDecisions.push(m.trim()));
  }

  if (keyDecisions.length === 0) {
    keyDecisions.push('Aligned on next review meeting to finalize commercial expectations.');
  }

  // Action Items extraction
  const actionItems: { title: string; dueDate?: string; priority: 'high' | 'medium' | 'low' }[] = [];
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  lines.forEach((line) => {
    const l = line.toLowerCase();
    if (l.startsWith('- [ ]') || l.startsWith('todo:') || l.startsWith('action:') || l.includes('will send') || l.includes('to follow up') || l.includes('by tomorrow') || l.includes('next week')) {
      const cleanLine = line.replace(/^-\s*\[\s*\]\s*/i, '').replace(/^(todo|action):\s*/i, '').trim();
      actionItems.push({
        title: cleanLine,
        priority: l.includes('urgent') || l.includes('asap') || l.includes('today') ? 'high' : 'medium',
      });
    }
  });

  if (actionItems.length === 0) {
    // Generate intelligent default action items from context
    actionItems.push({
      title: `Send tailored follow-up recap to ${leadContext?.contactName || 'client'} with agreed points`,
      priority: 'high',
    });
    if (objections.length > 0) {
      actionItems.push({
        title: `Prepare objection-handling collateral regarding ${objections[0].objection}`,
        priority: 'medium',
      });
    }
    actionItems.push({
      title: 'Schedule next pipeline progress check-in meeting',
      priority: 'medium',
    });
  }

  // Title and Summary Synthesis
  const title = leadContext?.companyName
    ? `Discovery & Strategy Sync · ${leadContext.companyName}`
    : `Client Strategy & Alignment Call`;

  const contactText = leadContext?.contactName ? `with ${leadContext.contactName}` : '';
  const summary = `Detailed commercial sync ${contactText}. Key discussion centered on operational requirements, current obstacles, and desired turnaround. ${
    objections.length
      ? `Main friction points identified: ${objections.map((o) => o.objection).join(', ')}.`
      : 'Conversation proceeded smoothly with positive buying sentiment.'
  } Immediate next steps were agreed with scheduled follow-through commitments.`;

  return {
    title,
    summary,
    actionItems,
    objections,
    keyDecisions,
    sentiment,
  };
}

/**
 * Intelligent personalized outreach draft generator.
 * Produces conversion-optimized copy for Email and WhatsApp.
 */
export function generateAiOutreachDraft(params: {
  lead: any;
  channel: 'EMAIL' | 'WHATSAPP';
  tone?: string;
  objective?: string;
  customNotes?: string;
  insight?: any;
  senderName?: string;
}): OutreachDraftResult {
  const { lead, channel, tone = 'consultative', objective, customNotes, senderName } = params;
  const name = lead.contactName?.split(' ')[0] || lead.contactName || 'there';
  const company = lead.companyName || 'your team';

  if (channel === 'WHATSAPP') {
    let message = '';
    if (objective === 'follow_up') {
      message = `Hi ${name}! Quick check-in following our recent conversation regarding ${company}. Just wanted to see if you had any questions on the proposal, or if Thursday works for a quick 10-min sync?`;
    } else if (objective === 'objection_pricing') {
      message = `Hi ${name}, hope you're having a great week! I was thinking about our conversation around budget and wanted to share a tailored milestone plan that might fit ${company} much better. Would you be open to a quick look?`;
    } else if (objective === 're_engagement') {
      message = `Hi ${name}! It's been a little while since we connected on ${company}'s sales workflow. We've just rolled out some new automation updates that I know you'd find valuable. Let me know if you'd like a quick preview!`;
    } else {
      message = `Hi ${name}! Touching base from Versaly CRM regarding your current pipeline setup. Would love to share how teams similar to ${company} are accelerating their deal velocity. Let me know if you have a few minutes this week!`;
    }

    if (customNotes) {
      message += ` (Note: ${customNotes})`;
    }

    return {
      subject: `WhatsApp Message to ${lead.contactName}`,
      content: message,
      channel: 'WHATSAPP',
    };
  }

  // Email Channel
  let subject = '';
  let content = '';

  if (objective === 'follow_up') {
    subject = `Next steps for ${company} & Versaly CRM`;
    content = `Hi ${name},

Thank you for your time during our recent discussion. It was great learning more about ${company}'s growth priorities.

To keep momentum going, I've outlined the key milestones we discussed:
• Seamless pipeline integration and team seat allocation
• Automated outreach tracking and proposal workflows
• Real-time deal intelligence to eliminate manual CRM updates

Does Thursday afternoon or Friday morning work for a quick 15-minute call to finalize the rollout schedule?

Best regards,
The Versaly Sales Team`;
  } else if (objective === 'objection_pricing') {
    subject = `Flexible options for ${company}`;
    content = `Hi ${name},

I wanted to circle back following our chat regarding the investment structure for ${company}.

We completely understand the importance of clear ROI and predictable cash flow. With that in mind, we can offer flexible milestone billing or an optimized seat configuration so you can start seeing tangible pipeline acceleration before committing to a larger tier.

Would you be open to a quick 10-minute touchpoint this week to explore this adjustment?

Best regards,
The Versaly Sales Team`;
  } else if (objective === 're_engagement') {
    subject = `Quick check-in regarding ${company}'s sales velocity`;
    content = `Hi ${name},

I hope you've been having a productive month!

I'm reaching out because we recently introduced new predictive deal copilot and customer retention tools in Versaly that directly target the bottlenecks we discussed previously for ${company}.

I'd love to share a 5-minute overview of how this can streamline your current operations. Let me know if you have availability later this week!

Warm regards,
The Versaly Sales Team`;
  } else {
    subject = `Accelerating client conversion at ${company}`;
    content = `Hi ${name},

I'm reaching out to introduce Versaly CRM — the modern command center built to streamline your sales pipeline, outreach touchpoints, and customer retention workflows in one unified hub.

We've helped teams similar to ${company} increase conversion velocity by over 25% while eliminating manual spreadsheet tracking.

Would you be open to a brief 10-minute demo to see how it works?

Best regards,
The Versaly Sales Team`;
  }

  if (customNotes) {
    content += `\n\nP.S. ${customNotes}`;
  }

  return {
    subject,
    content,
    channel: 'EMAIL',
  };
}