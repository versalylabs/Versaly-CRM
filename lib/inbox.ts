import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import { logLeadActivity } from '@/lib/automation';

export interface SendMessageParams {
  conversationId: string;
  senderId?: string;
  senderName?: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X' | 'INTERNAL_NOTE';
  content: string;
  subject?: string;
  isInternal?: boolean;
}

export interface SmartReplySuggestion {
  id: string;
  label: string;
  text: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X';
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

/**
 * Retrieves an existing conversation thread for a lead or creates a new one.
 */
export async function getOrCreateLeadConversation(params: {
  organizationId: string;
  leadId: string;
  channel?: string;
  subject?: string;
  assignedToId?: string;
}) {
  const { organizationId, leadId, channel = 'EMAIL', subject, assignedToId } = params;

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId,
      leadId,
    },
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          email: true,
          phone: true,
          pipelineStage: true,
          outreachStatus: true,
          dealValue: true,
          aiInsight: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      messages: {
        orderBy: { sentAt: 'asc' },
        take: 50,
      },
    },
  });

  if (!conversation) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead) throw new Error('Lead not found in this organization');

    const defaultSubject = subject || `Conversation with ${lead.contactName}${lead.companyName ? ` (${lead.companyName})` : ''}`;

    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        leadId,
        channel,
        subject: defaultSubject,
        assignedToId: assignedToId || lead.assignedToId || undefined,
        status: 'OPEN',
        lastMessageSnippet: 'Thread started',
      },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            email: true,
            phone: true,
            pipelineStage: true,
            outreachStatus: true,
            dealValue: true,
            aiInsight: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });
  }

  return conversation;
}

/**
 * Dispatches an outbound omnichannel message or records an internal note.
 */
export async function sendUnifiedMessage(params: SendMessageParams) {
  const {
    conversationId,
    senderId,
    senderName,
    channel,
    content,
    subject,
    isInternal = false,
  } = params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: true },
  });

  if (!conversation) {
    throw new Error('Conversation thread not found');
  }

  const lead = conversation.lead;
  const sentAt = new Date();
  let providerMetadata: any = null;
  let deliveryStatus = 'SENT';

  // 1. Internal Team Note
  if (isInternal || channel === 'INTERNAL_NOTE') {
    const message = await prisma.conversationMessage.create({
      data: {
        conversationId,
        senderType: 'AGENT',
        senderId: senderId || null,
        senderName: senderName || 'Team Member',
        channel: 'INTERNAL_NOTE',
        content,
        isInternal: true,
        status: 'DELIVERED',
        sentAt,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: sentAt,
        lastMessageSnippet: `[Internal Note] ${content.slice(0, 60)}`,
        status: 'OPEN',
      },
    });

    return { success: true, message, deliveryMode: 'INTERNAL' };
  }

  // 2. WhatsApp Outbound
  if (channel === 'WHATSAPP') {
    const rawPhone = lead.phone ? normalizePhone(lead.phone) : '';
    if (isWhatsAppConfigured() && rawPhone.length >= 8) {
      try {
        const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
        const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: rawPhone,
            type: 'text',
            text: { preview_url: true, body: content },
          }),
        });
        providerMetadata = await res.json();
        if (!res.ok) {
          deliveryStatus = 'FAILED';
        }
      } catch (err: any) {
        console.error('WhatsApp API dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      // Local graceful simulation mode
      providerMetadata = { simulated: true, note: 'Recorded in CRM without external WhatsApp provider' };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'WHATSAPP',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'WHATSAPP',
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: content.slice(0, 80),
          status: 'WAITING_ON_CUSTOMER',
          channel: 'WHATSAPP',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'WHATSAPP' };
  }

  // 3. Email Outbound
  if (channel === 'EMAIL' || channel === 'SMS') {
    const emailSubject = subject || conversation.subject || `Follow-up regarding ${lead.companyName || 'your project'}`;
    if (isSmtpConfigured() && lead.email && /^\S+@\S+\.\S+$/.test(lead.email)) {
      try {
        const port = Number(process.env.SMTP_PORT || 587);
        const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        });

        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: lead.email,
          subject: emailSubject,
          text: content,
        });
        providerMetadata = { messageId: info.messageId, response: info.response };
      } catch (err: any) {
        console.error('SMTP email dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      providerMetadata = { simulated: true, note: 'Recorded in CRM without external SMTP provider' };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'EMAIL',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'EMAIL',
          subject: emailSubject,
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: content.slice(0, 80),
          status: 'WAITING_ON_CUSTOMER',
          channel: 'EMAIL',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'EMAIL' };
  }

  // 4. Instagram Direct Message Outbound
  if (channel === 'INSTAGRAM') {
    const account = await prisma.connectedChannelAccount.findFirst({
      where: { organizationId: conversation.organizationId, channel: 'INSTAGRAM', status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    const igToken = account?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    const recipient = lead.instagram || conversation.lead.contactName;

    if (igToken) {
      try {
        const res = await fetch('https://graph.facebook.com/v21.0/me/messages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${igToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: recipient },
            message: { text: content },
          }),
        });
        providerMetadata = await res.json();
        if (!res.ok) deliveryStatus = 'FAILED';
      } catch (err: any) {
        console.error('Instagram Graph API dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      providerMetadata = {
        simulated: true,
        channel: 'INSTAGRAM',
        senderAccount: account?.accountHandle || '@straten_crm',
        recipient,
        note: 'Dispatched via Straten Instagram Business API Gateway',
      };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'INSTAGRAM',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'INSTAGRAM',
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: `[IG DM] ${content.slice(0, 70)}`,
          status: 'WAITING_ON_CUSTOMER',
          channel: 'INSTAGRAM',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'INSTAGRAM' };
  }

  // 5. Facebook Messenger Outbound
  if (channel === 'FACEBOOK') {
    const account = await prisma.connectedChannelAccount.findFirst({
      where: { organizationId: conversation.organizationId, channel: 'FACEBOOK', status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    const fbToken = account?.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const recipient = lead.facebook || conversation.lead.contactName;

    if (fbToken) {
      try {
        const res = await fetch('https://graph.facebook.com/v21.0/me/messages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${fbToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: recipient },
            message: { text: content },
          }),
        });
        providerMetadata = await res.json();
        if (!res.ok) deliveryStatus = 'FAILED';
      } catch (err: any) {
        console.error('Facebook Messenger API dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      providerMetadata = {
        simulated: true,
        channel: 'FACEBOOK',
        senderPage: account?.accountName || 'Straten Agency Official',
        senderHandle: account?.accountHandle || 'straten.official',
        recipient,
        note: 'Dispatched via Straten Facebook Messenger Gateway',
      };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'FACEBOOK',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'FACEBOOK',
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: `[FB Messenger] ${content.slice(0, 70)}`,
          status: 'WAITING_ON_CUSTOMER',
          channel: 'FACEBOOK',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'FACEBOOK' };
  }

  // 6. TikTok Direct Message Outbound
  if (channel === 'TIKTOK') {
    const account = await prisma.connectedChannelAccount.findFirst({
      where: { organizationId: conversation.organizationId, channel: 'TIKTOK', status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    const ttToken = account?.accessToken || process.env.TIKTOK_ACCESS_TOKEN;
    const recipient = lead.tiktok || lead.contactName;

    if (ttToken) {
      try {
        const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/im/message/send/', {
          method: 'POST',
          headers: {
            'Access-Token': ttToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient_id: recipient,
            content: content,
          }),
        });
        providerMetadata = await res.json();
        if (!res.ok) deliveryStatus = 'FAILED';
      } catch (err: any) {
        console.error('TikTok Direct Message API dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      providerMetadata = {
        simulated: true,
        channel: 'TIKTOK',
        senderHandle: account?.accountHandle || '@straten_growth',
        recipient,
        note: 'Dispatched via Straten TikTok for Business Gateway',
      };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'TIKTOK',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'TIKTOK',
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: `[TikTok DM] ${content.slice(0, 70)}`,
          status: 'WAITING_ON_CUSTOMER',
          channel: 'TIKTOK',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'TIKTOK' };
  }

  // 7. X (formerly Twitter) Direct Message Outbound
  if (channel === 'X') {
    const account = await prisma.connectedChannelAccount.findFirst({
      where: { organizationId: conversation.organizationId, channel: 'X', status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    const xToken = account?.accessToken || process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
    const recipient = lead.xHandle || lead.contactName;

    if (xToken) {
      try {
        const res = await fetch('https://api.twitter.com/2/dm_conversations/messages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${xToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: { text: content },
          }),
        });
        providerMetadata = await res.json();
        if (!res.ok) deliveryStatus = 'FAILED';
      } catch (err: any) {
        console.error('X API v2 Direct Message dispatch error:', err);
        deliveryStatus = 'FAILED';
      }
    } else {
      providerMetadata = {
        simulated: true,
        channel: 'X',
        senderHandle: account?.accountHandle || '@versalylabs',
        recipient,
        note: 'Dispatched via Straten X API v2 Direct Messages Gateway',
      };
    }

    const [message, log] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          senderType: 'AGENT',
          senderId: senderId || null,
          senderName: senderName || 'Account Rep',
          channel: 'X',
          content,
          isInternal: false,
          status: deliveryStatus,
          metadata: providerMetadata ? providerMetadata : undefined,
          sentAt,
        },
      }),
      prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          type: 'X',
          content,
          status: 'SENT',
          sentAt,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'SENT',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING'].includes(lead.pipelineStage) ? 'CONTACTED' : undefined,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          lastMessageSnippet: `[X DM] ${content.slice(0, 70)}`,
          status: 'WAITING_ON_CUSTOMER',
          channel: 'X',
        },
      }),
    ]);

    return { success: true, message, outreachLog: log, deliveryMode: 'X' };
  }

  throw new Error(`Unsupported channel: ${channel}`);
}

/**
 * Simulates receiving an inbound reply from a lead.
 * Useful for automated tests, demonstrations, and QA validation.
 */
export async function simulateInboundMessage(params: {
  conversationId: string;
  content: string;
  channel?: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X';
}) {
  const { conversationId, content, channel = 'WHATSAPP' } = params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: true },
  });

  if (!conversation) throw new Error('Conversation not found');

  const lead = conversation.lead;
  const sentAt = new Date();

  const [message] = await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId,
        senderType: 'LEAD',
        senderName: lead.contactName,
        channel,
        content,
        isInternal: false,
        status: 'READ',
        sentAt,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: sentAt,
        lastMessageSnippet: content.slice(0, 80),
        status: 'WAITING_ON_US',
        unreadCount: { increment: 1 },
      },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastContact: sentAt,
        outreachStatus: 'REPLIED',
        pipelineStage: lead.pipelineStage === 'CONTACTED' ? 'FOLLOW_UP' : undefined,
      },
    }),
  ]);

  // Create in-app notification for the workspace
  try {
    if (conversation.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: conversation.assignedToId,
          type: 'INBOUND_MESSAGE',
          title: `New ${channel} reply from ${lead.contactName}`,
          message: content.slice(0, 100),
          href: `/inbox?conversationId=${conversationId}`,
        },
      });
    }
  } catch (e) {
    // Non-blocking
  }

  return message;
}

/**
 * Processes and stores a live inbound message received from external webhooks
 * (Meta Instagram, Facebook Messenger, WhatsApp Cloud, TikTok, X, or Custom webhooks).
 */
export async function recordInboundChannelMessage(params: {
  channel: 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X' | 'WHATSAPP' | 'EMAIL';
  content: string;
  senderExternalId?: string;
  senderHandle?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  organizationId?: string;
  metadata?: any;
}) {
  const {
    channel,
    content,
    senderExternalId,
    senderHandle,
    senderName,
    senderEmail,
    senderPhone,
    organizationId,
    metadata,
  } = params;

  let orgId = organizationId;
  if (!orgId) {
    if (senderHandle) {
      const channelAcc = await prisma.connectedChannelAccount.findFirst({
        where: { channel, status: 'CONNECTED' },
      });
      orgId = channelAcc?.organizationId;
    }
  }

  if (!orgId) {
    const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstOrg) throw new Error('No organization registered in system');
    orgId = firstOrg.id;
  }

  let lead: any = null;

  if (senderEmail) {
    lead = await prisma.lead.findFirst({
      where: { organizationId: orgId, email: senderEmail },
    });
  }

  if (!lead && senderPhone) {
    const cleanPhone = normalizePhone(senderPhone);
    lead = await prisma.lead.findFirst({
      where: { organizationId: orgId, phone: { contains: cleanPhone.slice(-8) } },
    });
  }

  if (!lead && senderHandle) {
    const clean = senderHandle.replace('@', '');
    lead = await prisma.lead.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { instagram: { contains: clean } },
          { facebook: { contains: clean } },
          { tiktok: { contains: clean } },
          { xHandle: { contains: clean } },
        ],
      },
    });
  }

  if (!lead) {
    const contact = senderName || senderHandle || (senderPhone ? `Phone ${senderPhone}` : `Prospect (${channel})`);
    const email = senderEmail || `${(senderHandle || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_${Date.now()}@inbound.crm`;

    lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        contactName: contact,
        email,
        phone: senderPhone || null,
        instagram: channel === 'INSTAGRAM' ? senderHandle || null : null,
        facebook: channel === 'FACEBOOK' ? senderHandle || null : null,
        tiktok: channel === 'TIKTOK' ? senderHandle || null : null,
        xHandle: channel === 'X' ? senderHandle || null : null,
        leadSource: 'SOCIAL_MEDIA',
        pipelineStage: 'NEW_LEAD',
        outreachStatus: 'REPLIED',
        notes: `Inbound inquiry via ${channel} ${senderHandle ? `(${senderHandle})` : ''}`,
      },
    });
  }

  const conversation = await getOrCreateLeadConversation({
    organizationId: orgId,
    leadId: lead.id,
    channel,
    subject: `Omnichannel Chat with ${lead.contactName}`,
  });

  const sentAt = new Date();

  const [message] = await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: 'LEAD',
        senderId: senderExternalId || null,
        senderName: lead.contactName,
        channel,
        content,
        metadata: metadata ? metadata : undefined,
        isInternal: false,
        status: 'DELIVERED',
        sentAt,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: sentAt,
        lastMessageSnippet: `[${channel}] ${content.slice(0, 70)}`,
        status: 'WAITING_ON_US',
        unreadCount: { increment: 1 },
      },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastContact: sentAt,
        outreachStatus: 'REPLIED',
        pipelineStage: ['NEW_LEAD', 'RESEARCHING', 'CONTACTED'].includes(lead.pipelineStage)
          ? 'FOLLOW_UP'
          : lead.pipelineStage,
      },
    }),
  ]);

  try {
    const notifyUser = conversation.assignedToId || (await prisma.user.findFirst({
      where: { organizationId: orgId, role: 'ADMIN' },
    }))?.id;

    if (notifyUser) {
      await prisma.notification.create({
        data: {
          userId: notifyUser,
          type: 'INBOUND_MESSAGE',
          title: `New ${channel} message from ${lead.contactName}`,
          message: content.slice(0, 100),
          href: `/inbox?conversationId=${conversation.id}`,
        },
      });
    }
  } catch (e) {
    // Non-blocking
  }

  return { conversation, message, lead };
}


/**
 * Generates 3 intelligent, 1-click suggested replies based on recent conversation context.
 */
export function generateSmartReplySuggestions(lead: any, lastMessageText: string = ''): SmartReplySuggestion[] {
  const firstName = lead.contactName?.split(' ')[0] || lead.contactName || 'there';
  const company = lead.companyName || 'your team';
  const lower = lastMessageText.toLowerCase();

  // Scenario 1: Inquiry about pricing/budget
  if (lower.includes('price') || lower.includes('cost') || lower.includes('quote') || lower.includes('discount')) {
    return [
      {
        id: 'pricing-1',
        label: 'Flexible Milestones',
        text: `Hi ${firstName}, thanks for asking! We offer flexible milestone-based payment schedules tailored for ${company}. Would a quick 10-minute overview call work for you this Thursday?`,
        channel: 'EMAIL',
      },
      {
        id: 'pricing-2',
        label: 'Send Formal Proposal',
        text: `Hi ${firstName}, I can prepare a custom commercial proposal breaking down exact deliverables and ROI for ${company}. What target go-live date are you aiming for?`,
        channel: 'EMAIL',
      },
      {
        id: 'pricing-3',
        label: 'Quick WhatsApp Pricing Sync',
        text: `Hey ${firstName}, happy to share pricing tiers that fit your budget. Are you free for a 5-min WhatsApp call today?`,
        channel: 'WHATSAPP',
      },
    ];
  }

  // Scenario 2: Positive buy signal / demo request
  if (lower.includes('demo') || lower.includes('call') || lower.includes('meet') || lower.includes('available') || lower.includes('schedule')) {
    return [
      {
        id: 'demo-1',
        label: 'Share Calendar Link',
        text: `Hi ${firstName}, absolutely! You can grab any 20-minute slot on my calendar that suits you best: https://calendar.versaly.io/sync. Looking forward to our demo!`,
        channel: 'EMAIL',
      },
      {
        id: 'demo-2',
        label: 'Propose Tomorrow Times',
        text: `Hi ${firstName}, glad to connect! Does tomorrow at 11:00 AM or 3:00 PM work for an interactive walkthrough for ${company}?`,
        channel: 'EMAIL',
      },
      {
        id: 'demo-3',
        label: 'WhatsApp Quick Confirmation',
        text: `Sounds great ${firstName}! I'll send over a calendar invite shortly. Who else from your team should join?`,
        channel: 'WHATSAPP',
      },
    ];
  }

  // Default context-aware suggestions
  return [
    {
      id: 'default-1',
      label: 'Check-in & Next Steps',
      text: `Hi ${firstName}, following up on our recent sync regarding ${company}. Let me know if you have any questions or if you'd like to review next steps!`,
      channel: 'EMAIL',
    },
    {
      id: 'default-2',
      label: 'Share Case Study & ROI',
      text: `Hi ${firstName}, thought you might find this relevant—we recently helped a similar team in your space increase deal velocity by 40%. Would love to share the brief case study!`,
      channel: 'EMAIL',
    },
    {
      id: 'default-3',
      label: 'Casual WhatsApp Touchpoint',
      text: `Hey ${firstName}, hope you're having a productive week! Just checking in to see if you had a chance to review our notes.`,
      channel: 'WHATSAPP',
    },
  ];
}

/**
 * Standard library of canned responses.
 */
export const CANNED_RESPONSES = [
  {
    id: 'intro',
    title: 'Warm Discovery Introduction',
    content: `Hi {{name}}, thanks for reaching out to us! We'd love to learn more about your goals at {{company}} and see how Versaly CRM can streamline your sales pipeline. When would be a good time for a brief 15-minute introductory call?`,
  },
  {
    id: 'pricing',
    title: 'Standard Pricing & Tiers',
    content: `Hi {{name}}, here is a quick overview of our plans. Our Growth Pro plan includes unlimited pipeline tracking, automated outreach cadences, and AI deal intelligence. Let us know if you'd like a customized quote for {{company}}.`,
  },
  {
    id: 'calendar',
    title: 'Calendar Booking Link',
    content: `Hi {{name}}, please feel free to pick a convenient slot directly on my calendar here: https://calendar.versaly.io/sync. Excited to speak with you!`,
  },
  {
    id: 'followup',
    title: 'Gentle Value Follow-Up',
    content: `Hi {{name}}, wanted to follow up on our previous note. We have some exciting updates that can help {{company}} accelerate conversions this quarter. Are you available for a quick touchpoint this week?`,
  },
];

/**
 * Retrieves all connected social channel accounts for an organization.
 * Sensitive tokens are sanitized for client display.
 */
export async function getConnectedChannelAccounts(organizationId: string) {
  const accounts = await prisma.connectedChannelAccount.findMany({
    where: { organizationId },
    orderBy: { connectedAt: 'desc' },
  });

  return accounts.map((acc) => ({
    id: acc.id,
    channel: acc.channel,
    accountName: acc.accountName,
    accountHandle: acc.accountHandle,
    externalAccountId: acc.externalAccountId,
    status: acc.status,
    avatarUrl: acc.avatarUrl,
    hasAccessToken: Boolean(acc.accessToken),
    hasAppSecret: Boolean(acc.appSecret),
    webhookSecret: acc.webhookSecret,
    connectedAt: acc.connectedAt,
    updatedAt: acc.updatedAt,
  }));
}

/**
 * Connects or updates a social channel account (Instagram, Facebook, TikTok, X).
 */
export async function upsertConnectedChannelAccount(params: {
  organizationId: string;
  channel: string;
  accountName: string;
  accountHandle: string;
  externalAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  appId?: string;
  appSecret?: string;
  webhookSecret?: string;
  avatarUrl?: string;
  metadata?: any;
}) {
  const {
    organizationId,
    channel,
    accountName,
    accountHandle,
    externalAccountId,
    accessToken,
    refreshToken,
    appId,
    appSecret,
    webhookSecret,
    avatarUrl,
    metadata,
  } = params;

  return await prisma.connectedChannelAccount.upsert({
    where: {
      organizationId_channel_accountHandle: {
        organizationId,
        channel,
        accountHandle,
      },
    },
    update: {
      accountName,
      externalAccountId: externalAccountId || undefined,
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
      appId: appId || undefined,
      appSecret: appSecret || undefined,
      webhookSecret: webhookSecret || undefined,
      status: 'CONNECTED',
      avatarUrl: avatarUrl || undefined,
      metadata: metadata || undefined,
      updatedAt: new Date(),
    },
    create: {
      organizationId,
      channel,
      accountName,
      accountHandle,
      externalAccountId: externalAccountId || null,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      appId: appId || null,
      appSecret: appSecret || null,
      webhookSecret: webhookSecret || `whsec_${Math.random().toString(36).substring(2, 12)}`,
      status: 'CONNECTED',
      avatarUrl: avatarUrl || null,
      metadata: metadata || null,
    },
  });
}

/**
 * Disconnects a channel account by ID for an organization.
 */
export async function disconnectChannelAccount(organizationId: string, accountId: string) {
  return await prisma.connectedChannelAccount.deleteMany({
    where: {
      id: accountId,
      organizationId,
    },
  });
}

