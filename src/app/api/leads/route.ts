import { blockIfReadOnly, leadLimitError } from '../../../../lib/subscription';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { assertSubscriptionWriteAccess } from '../../../../lib/subscription';
import prisma from '../../../../lib/prisma';
import { createNotification, getManagerIds, leadHref } from '../../../../lib/notifications';
import { executeAutomationWorkflows } from '../../../../lib/workflows';
import { emitWebhookEvent } from '../../../../lib/integrations';

// GET /api/leads - list all leads (supports ?search= and ?stage= query params)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();
  const stage = searchParams.get('stage');

  const where: any = {};
  if (!session.user?.organizationId) return NextResponse.json({ error: 'No workspace found for this user.' }, { status: 403 });
  {
    where.organizationId = session.user.organizationId;
  }
  const assignedTo = searchParams.get('assignedTo');

  if (stage) {
    where.pipelineStage = stage;
  }
  if (assignedTo) where.assignedToId = assignedTo;

  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: 'insensitive' as const } },
      { companyName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } },
  });

  return NextResponse.json(leads);
}

// POST /api/leads - create a new lead
export async function POST(req: NextRequest) {
  const readOnly = await blockIfReadOnly();
  if (readOnly) return readOnly;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Email is optional (WhatsApp contacts often have none), but a lead needs some way to reach them.
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null;
  const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
  if (!body.contactName || !body.leadSource || (!email && !phone)) {
    return NextResponse.json(
      { error: 'Contact name, lead source and an email or phone number are required' },
      { status: 400 }
    );
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const dealValue = body.dealValue === '' || body.dealValue == null
    ? null
    : Number(body.dealValue);

  if (dealValue !== null && !Number.isFinite(dealValue)) {
    return NextResponse.json(
      { error: 'Deal value must be a valid number' },
      { status: 400 }
    );
  }

  try {
    if (!session.user?.organizationId) {
      return NextResponse.json({ error: 'No workspace found for this user.' }, { status: 403 });
    }
    const limit = await leadLimitError(session.user.organizationId);
    if (limit) return NextResponse.json({ error: limit }, { status: 403 });

    const lead = await prisma.lead.create({
      data: {
        organizationId: session.user.organizationId,
        companyName: body.companyName || null,
        contactName: body.contactName,
        jobTitle: body.jobTitle || null,
        email,
        phone,
        website: body.website || null,
        location: body.location || null,
        businessType: body.businessType || null,
        instagram: body.instagram || null,
        linkedin: body.linkedin || null,
        facebook: body.facebook || null,
        leadSource: body.leadSource,
        pipelineStage: body.pipelineStage || 'NEW_LEAD',
        outreachStatus: body.outreachStatus || 'PENDING',
        dealValue,
        notes: body.notes || null,
        assignedToId: body.assignedToId || null,
      },
    });

    if (lead.organizationId) { try { await emitWebhookEvent(lead.organizationId, 'lead.created', lead); } catch (e) { console.error('Lead webhook failed:', e); } try { await executeAutomationWorkflows({ organizationId: lead.organizationId, triggerType: 'LEAD_CREATED', leadId: lead.id, eventId: `lead-created:${lead.id}` }); } catch (e) { console.error('Lead-created workflow failed:', e); } }

    if (lead.assignedToId) {
      await createNotification({ userId: lead.assignedToId, type: 'LEAD_ASSIGNED', title: 'New lead assigned', message: `${lead.contactName}${lead.companyName ? ` — ${lead.companyName}` : ''} was assigned to you.`, href: leadHref(lead.id), category: 'lead' });
    } else {
      const managers = await getManagerIds(lead.organizationId || "");
      await Promise.all(managers.map((userId) => createNotification({ userId, type: 'LEAD_UNASSIGNED', title: 'New unassigned lead', message: `${lead.contactName} needs an owner.`, href: leadHref(lead.id), category: 'lead' })));
    }
    return NextResponse.json(lead, { status: 201 });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'A lead with this email already exists in this workspace' },
        { status: 409 }
      );
    }
    console.error('Failed to create lead:', err);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
