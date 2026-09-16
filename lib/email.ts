import nodemailer from 'nodemailer';

type EmailInput = { to: string; subject: string; text: string; html?: string };

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

export async function sendEmail(input: EmailInput) {
  if (!isSmtpConfigured()) return { sent: false as const, skipped: true as const, reason: 'SMTP is not configured' };
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM, ...input });
  return { sent: true as const, skipped: false as const, messageId: info.messageId };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

export async function sendWelcomeEmail(input: { to: string; name: string; organizationName: string; plan: string; loginUrl: string }) {
  const subject = `Welcome to ${input.organizationName} on Straten CRM`;
  const text = `Hi ${input.name},\n\nWelcome to Straten CRM! Your ${input.organizationName} workspace is ready on the ${input.plan.replace('_', ' ')} plan. We've added a starter pipeline, sample leads, and an onboarding checklist so you can explore the workspace immediately.\n\nOpen your workspace: ${input.loginUrl}\n\n— Straten CRM`;
  const html = `<p>Hi ${escapeHtml(input.name)},</p><p>Welcome to <strong>Straten CRM</strong>! Your <strong>${escapeHtml(input.organizationName)}</strong> workspace is ready.</p><p>We've added a starter pipeline, sample leads, and an onboarding checklist so the workspace is ready to explore.</p><p><a href="${escapeHtml(input.loginUrl)}">Open your workspace</a></p><p>— Straten CRM</p>`;
  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendInviteEmail(input: { to: string; organizationName: string; role: string; inviteUrl: string; expiresAt: Date }) {
  const subject = `You're invited to join ${input.organizationName} on Straten CRM`;
  const expiry = input.expiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const text = `You've been invited to join ${input.organizationName} as ${input.role}. Accept your secure invitation: ${input.inviteUrl}\n\nThis invitation expires ${expiry}.`;
  const html = `<p>You've been invited to join <strong>${escapeHtml(input.organizationName)}</strong> as <strong>${escapeHtml(input.role)}</strong>.</p><p><a href="${escapeHtml(input.inviteUrl)}">Accept secure invitation</a></p><p>This invitation expires ${escapeHtml(expiry)}.</p>`;
  return sendEmail({ to: input.to, subject, text, html });
}
