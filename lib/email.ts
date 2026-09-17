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
  const subject = `Welcome to ${input.organizationName} on Versaly CRM`;
  const text = `Hi ${input.name},\n\nWelcome to Versaly CRM! Your ${input.organizationName} workspace is ready on the ${input.plan.replace('_', ' ')} plan. We've added a starter pipeline, sample leads, and an onboarding checklist so you can explore the workspace immediately.\n\nOpen your workspace: ${input.loginUrl}\n\n— Versaly CRM`;
  const html = `<p>Hi ${escapeHtml(input.name)},</p><p>Welcome to <strong>Versaly CRM</strong>! Your <strong>${escapeHtml(input.organizationName)}</strong> workspace is ready.</p><p>We've added a starter pipeline, sample leads, and an onboarding checklist so the workspace is ready to explore.</p><p><a href="${escapeHtml(input.loginUrl)}">Open your workspace</a></p><p>— Versaly CRM</p>`;
  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendInviteEmail(input: { to: string; organizationName: string; role: string; inviteUrl: string; expiresAt: Date }) {
  const subject = `You're invited to join ${input.organizationName} on Versaly CRM`;
  const expiry = input.expiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const text = `You've been invited to join ${input.organizationName} as ${input.role}. Accept your secure invitation: ${input.inviteUrl}\n\nThis invitation expires ${expiry}.`;
  const html = `<p>You've been invited to join <strong>${escapeHtml(input.organizationName)}</strong> as <strong>${escapeHtml(input.role)}</strong>.</p><p><a href="${escapeHtml(input.inviteUrl)}">Accept secure invitation</a></p><p>This invitation expires ${escapeHtml(expiry)}.</p>`;
  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendContactFormEmail(input: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message: string;
}) {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'versalylabs@gmail.com';
  const emailSubject = `[Versaly CRM Lead / Inquiry] ${input.subject || 'New Contact Form Submission'} from ${input.name}`;
  const text = `New contact inquiry received on Versaly CRM Landing Page:

Name: ${input.name}
Email: ${input.email}
Phone: ${input.phone || 'Not provided'}
Company: ${input.company || 'Not provided'}
Subject: ${input.subject || 'General Inquiry'}

Message:
${input.message}

Received at: ${new Date().toLocaleString()}
Reply directly to: ${input.email}
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #0284c7, #06b6d4); padding: 18px 24px; border-radius: 6px; color: white;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">New Lead / Contact Form Inquiry</h2>
    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">Delivered from Versaly CRM Landing Page</p>
  </div>
  <div style="padding: 24px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 8px 0; color: #64748b; width: 120px;"><strong>Name:</strong></td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(input.name)}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0; color: #0284c7; font-weight: 600;"><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(input.phone || 'Not provided')}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;"><strong>Company:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(input.company || 'Not provided')}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;"><strong>Inquiry Type:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(input.subject || 'General Inquiry')}</td></tr>
    </table>
    <div style="margin-top: 18px; padding: 16px; background: #f8fafc; border-left: 4px solid #0284c7; border-radius: 4px;">
      <strong style="color: #334155; display: block; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Message:</strong>
      <p style="margin: 0; color: #1e293b; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(input.message)}</p>
    </div>
  </div>
  <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8;">
    <p style="margin: 0;">This email was automatically dispatched to ${escapeHtml(adminEmail)}. You can click reply to email the prospect directly.</p>
  </div>
</div>
`;

  return sendEmail({
    to: adminEmail,
    subject: emailSubject,
    text,
    html,
  });
}
