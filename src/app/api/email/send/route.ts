import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { logLeadActivity } from '../../../../../lib/automation';

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ configured: smtpConfigured(), from: process.env.SMTP_FROM || null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!smtpConfigured()) {
    return NextResponse.json({
      error: 'Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM to your environment before sending email.',
    }, { status: 503 });
  }

  const body = await req.json();
  const leadId = String(body.leadId || '').trim();
  const subject = String(body.subject || '').trim();
  const content = String(body.content || '').trim();
  const to = String(body.to || '').trim();

  if (!leadId || !subject || !content) {
    return NextResponse.json({ error: 'Lead, subject, and message are required.' }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  const recipient = to || lead.email;
  if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
    return NextResponse.json({ error: 'A valid recipient email address is required.' }, { status: 400 });
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipient,
      subject,
      text: content,
    });
  } catch (error) {
    console.error('CRM email send failed', error);
    return NextResponse.json({ error: 'The email could not be sent. Check your SMTP configuration and try again.' }, { status: 502 });
  }

  const sentAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.outreachLog.create({
      data: { leadId: lead.id, type: 'EMAIL', subject, content, status: 'SENT', sentAt },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lastContact: sentAt,
        outreachStatus: 'SENT',
        pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
      },
    });
    await logLeadActivity(tx, lead.id, 'email', 'Email sent from CRM', {
      subject,
      recipient,
      outreachLogId: log.id,
      userId: session.user?.id || null,
    });
    return log;
  });

  return NextResponse.json({ success: true, outreachLog: result }, { status: 201 });
}
