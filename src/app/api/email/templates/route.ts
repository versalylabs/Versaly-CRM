import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

const DEFAULT_TEMPLATES = [
  {
    name: 'Strategic Partnership & Introduction',
    category: 'Outreach',
    subject: 'Exploring strategic synergies between {{companyName}} and Versaly',
    body: `Hi {{contactName}},

I’ve been closely following {{companyName}}'s rapid momentum in the industry and was genuinely impressed by your team’s focus and execution.

At Versaly, we help high-growth businesses streamline multi-channel customer communications, accelerate deal conversion cycles, and automate client follow-ups from a single platform.

Would you be open to a brief 10-minute introductory conversation this Thursday or Friday to explore whether our platform aligns with {{companyName}}'s growth priorities for the coming quarter?

Warm regards,
Versaly Growth & Partnerships`,
    isActive: true,
  },
  {
    name: 'Post-Discovery Call Recap & Next Steps',
    category: 'Follow-Up',
    subject: 'Recap: Our conversation & proposed milestones for {{companyName}}',
    body: `Hi {{contactName}},

Thank you for taking the time to speak with us today. It was great learning more about {{companyName}}'s operational priorities and how your team approaches client acquisition.

As discussed, here is a quick summary of our key takeaways and immediate next steps:
1. Review tailored workflow integrations to align with your current pipeline structure.
2. Outline user onboarding milestones for your sales and retention reps.
3. Deliver a custom commercial agreement for leadership approval.

Please let me know if I missed any key priorities from our discussion. Looking forward to our next sync!

Best regards,
Client Solutions Team`,
    isActive: true,
  },
  {
    name: 'Executive Proposal & Commercial Terms',
    category: 'Proposal',
    subject: 'Executive Proposal & Scope of Work — {{companyName}}',
    body: `Dear {{contactName}},

Attached is our formal commercial proposal and service-level agreement tailored specifically for {{companyName}}.

This package outlines our full deliverable scope, platform onboarding timeline, and ROI expectations based on the metrics we established during our discovery sessions.

Please review the proposal terms at your convenience. I am available anytime this week for a 15-minute walkthrough to answer any questions from your executive team before finalizing signatures.

Respectfully,
Senior Account Executive`,
    isActive: true,
  },
  {
    name: 'Quarterly Client Success & Health Check',
    category: 'Retention',
    subject: 'Quarterly Strategy Check-in & Value Realization — {{companyName}}',
    body: `Hi {{contactName}},

I hope you’re having a wonderful week! With our engagement well underway, I wanted to schedule our regular quarterly sync to review your platform usage metrics, celebrate recent milestone achievements, and gather your feedback.

Our goal is to ensure {{companyName}} is realizing maximum ROI and that your team is fully supported with our latest automation and outreach capabilities.

Could you let me know what day next week works best for your team for a 20-minute strategic review?

Sincerely,
Customer Success & Retention Lead`,
    isActive: true,
  },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let count = await prisma.emailTemplate.count();
  if (count === 0) {
    for (const tmpl of DEFAULT_TEMPLATES) {
      await prisma.emailTemplate.create({ data: tmpl }).catch(() => {});
    }
  }

  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  const subject = String(body.subject || '').trim();
  const templateBody = String(body.body || '').trim();
  const category = String(body.category || '').trim() || null;

  if (!name || !subject || !templateBody) {
    return NextResponse.json({ error: 'Name, subject, and email body are required.' }, { status: 400 });
  }

  try {
    const template = await prisma.emailTemplate.create({
      data: { name, subject, body: templateBody, category, isActive: body.isActive !== false },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A template with that name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not create email template.' }, { status: 500 });
  }
}
