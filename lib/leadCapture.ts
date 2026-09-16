import nodemailer from 'nodemailer';
import prisma from './prisma';
import { logLeadActivity } from './automation';

type CaptureInput = Record<string, any>;

const sourceMap: Record<string, string> = {
  WEBSITE: 'WEBSITE_FORM', WEBSITE_FORM: 'WEBSITE_FORM', FORM: 'WEBSITE_FORM',
  FACEBOOK: 'SOCIAL_MEDIA', META: 'SOCIAL_MEDIA', INSTAGRAM: 'SOCIAL_MEDIA', SOCIAL: 'SOCIAL_MEDIA', SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  REFERRAL: 'REFERRAL', EVENT: 'EVENT', COLD_OUTREACH: 'COLD_OUTREACH', OTHER: 'OTHER'
};

function value(input: CaptureInput, key: string) {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : v;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

async function selectAssignee(tx: any, organizationId?: string | null) {
  if (String(process.env.AUTO_ASSIGN_EXTERNAL_LEADS || 'true').toLowerCase() === 'false') return null;
  const users = await tx.user.findMany({
    where: { isActive: true, role: { in: ['AGENT', 'MANAGER'] }, ...(organizationId ? { organizationId } : {}) },
    include: { _count: { select: { assignedLeads: { where: { pipelineStage: { notIn: ['WON', 'LOST'] } } } } } },
    orderBy: [{ createdAt: 'asc' }],
  });
  if (!users.length) return null;
  users.sort((a: any, b: any) => a._count.assignedLeads - b._count.assignedLeads || a.createdAt.getTime() - b.createdAt.getTime());
  return users[0].id;
}

async function sendWelcomeEmail(lead: any) {
  if (String(process.env.AUTO_WELCOME_EMAIL || 'false').toLowerCase() !== 'true' || !smtpConfigured()) return false;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const subject = process.env.AUTO_WELCOME_SUBJECT || 'Thanks for getting in touch with Straten Agency';
  const text = (process.env.AUTO_WELCOME_MESSAGE || 'Hi {{contactName}},\n\nThanks for reaching out to Straten Agency. A member of our team will be in touch shortly.\n\nBest regards,\nStraten Agency')
    .replace(/{{contactName}}/g, lead.contactName || '')
    .replace(/{{companyName}}/g, lead.companyName || '');
  await transporter.sendMail({ from: process.env.SMTP_FROM, to: lead.email, subject, text });
  return true;
}

export function normalizeCaptureInput(input: CaptureInput, defaultSource = 'WEBSITE_FORM') {
  const email = String(value(input, 'email') || '').toLowerCase();
  const contactName = value(input, 'contactName') || value(input, 'name') || [value(input, 'firstName'), value(input, 'lastName')].filter(Boolean).join(' ');
  const rawSource = String(value(input, 'leadSource') || value(input, 'source') || defaultSource).toUpperCase();
  return {
    contactName: String(contactName || '').trim(), email, companyName: value(input, 'companyName') || value(input, 'company') || null,
    phone: value(input, 'phone') || null, website: value(input, 'website') || null, location: value(input, 'location') || null,
    jobTitle: value(input, 'jobTitle') || null, notes: value(input, 'notes') || value(input, 'message') || null,
    leadSource: sourceMap[rawSource] || defaultSource, externalSource: value(input, 'externalSource') || rawSource,
  };
}

export async function captureLead(input: CaptureInput, options: { defaultSource?: string; channel: string; organizationId?: string | null }) {
  const data = normalizeCaptureInput(input, options.defaultSource || 'WEBSITE_FORM');
  if (!data.contactName || !data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
    return { ok: false, status: 400, error: 'A valid contactName (or name) and email are required.' };
  }

  const existing = await prisma.lead.findFirst({ where: { email: data.email, ...(options.organizationId ? { organizationId: options.organizationId } : {}) } });
  if (existing) {
    await prisma.activityEvent.create({ data: { leadId: existing.id, type: 'LEAD_CAPTURE', action: 'Duplicate external lead received', metadata: { channel: options.channel, externalSource: data.externalSource } as any } });
    return { ok: true, duplicate: true, lead: existing, status: 200 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const assignedToId = await selectAssignee(tx, options.organizationId);
    const lead = await tx.lead.create({ data: {
      contactName: data.contactName, email: data.email, companyName: data.companyName, phone: data.phone, website: data.website,
      location: data.location, jobTitle: data.jobTitle, notes: data.notes, leadSource: data.leadSource as any,
      organizationId: options.organizationId || null,
      pipelineStage: 'NEW_LEAD', assignedToId,
    } });
    await logLeadActivity(tx, lead.id, 'LEAD_CAPTURE', 'External lead captured', { channel: options.channel, externalSource: data.externalSource, autoAssigned: Boolean(assignedToId) });
    const task = await tx.task.create({ data: {
      leadId: lead.id, organizationId: options.organizationId || null, assignedToId, title: `Respond to new lead: ${lead.contactName}`,
      description: `[AUTO_EXTERNAL_LEAD] New ${options.channel.toLowerCase()} lead captured automatically.`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), priority: 'high'
    } });
    await logLeadActivity(tx, lead.id, 'TASK', 'Automatic new-lead response task created', { taskId: task.id, assignedToId });
    return { lead, task, assignedToId };
  });

  let welcomeEmailSent = false;
  try { welcomeEmailSent = await sendWelcomeEmail(result.lead); } catch (error) { console.error('Automatic welcome email failed', error); }
  if (welcomeEmailSent) {
    await prisma.$transaction(async (tx) => {
      await tx.outreachLog.create({ data: { leadId: result.lead.id, type: 'EMAIL', subject: process.env.AUTO_WELCOME_SUBJECT || 'Thanks for getting in touch with Straten Agency', content: 'Automatic welcome email sent from external lead workflow.', status: 'SENT' } });
      await tx.lead.update({ where: { id: result.lead.id }, data: { lastContact: new Date(), outreachStatus: 'SENT' } });
      await logLeadActivity(tx, result.lead.id, 'EMAIL', 'Automatic welcome email sent', { channel: options.channel });
    });
  }
  return { ok: true, duplicate: false, status: 201, ...result, welcomeEmailSent };
}
