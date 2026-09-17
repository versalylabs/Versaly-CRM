import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';
import { captureLead } from '@/lib/leadCapture';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, company, subject, message } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Please provide your name.' }, { status: 400 });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Please provide a message or inquiry details.' }, { status: 400 });
    }

    // 1. Dispatch notification email to versalylabs@gmail.com
    let emailDispatched = false;
    try {
      const emailResult = await sendContactFormEmail({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || undefined,
        company: company?.trim() || undefined,
        subject: subject?.trim() || undefined,
        message: message.trim(),
      });
      emailDispatched = Boolean(emailResult?.sent);
    } catch (err: any) {
      console.error('Failed to send contact notification email:', err);
    }

    // 2. Ingest lead into CRM system
    try {
      const primaryOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      await captureLead(
        {
          contactName: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || null,
          companyName: company?.trim() || null,
          notes: `[CONTACT_FORM_INQUIRY] Subject: ${subject || 'General Inquiry'}\n\nMessage:\n${message.trim()}`,
          leadSource: 'WEBSITE_FORM',
          externalSource: 'LANDING_PAGE_CONTACT',
        },
        {
          channel: 'WEBSITE_FORM',
          organizationId: primaryOrg?.id || null,
        }
      );
    } catch (err: any) {
      console.error('Lead capture error:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your message has been sent successfully. Our team will contact you shortly.',
      emailDispatched,
    });
  } catch (error: any) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while submitting your message. Please try again.' },
      { status: 500 }
    );
  }
}
