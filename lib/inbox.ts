import prisma from '@/lib/prisma';
import { decryptSecret, encryptSecret, generateWebhookSecret } from '@/lib/secretBox';
import { providerRegistry, CommunicationChannel, SendMessageInput, InboundParsedMessage } from '@/lib/communication-providers';

export * from './inbox-shared';

export interface SendUnifiedMessageParams {
  organizationId: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  channel: CommunicationChannel;
  content: string;
  subject?: string;
  isInternal?: boolean;
  metadata?: Record<string, any>;
  attachments?: any[];
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

/**
 * Retrieves an existing conversation thread or creates a new one.
 * Supports both lead-associated conversations and unknown incoming contact threads.
 */
export async function getOrCreateConversation(params: {
  organizationId: string;
  leadId?: string | null;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactHandle?: string;
  channel?: string;
  subject?: string;
  assignedToId?: string;
}) {
  const {
    organizationId,
    leadId,
    contactName,
    contactEmail,
    contactPhone,
    contactHandle,
    channel = 'EMAIL',
    subject,
    assignedToId,
  } = params;

  // 1. Search for existing conversation
  let conversation: any = null;

  if (leadId) {
    conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        leadId,
      },
      include: {
        lead: {
          include: {
            tasks: { where: { completed: false }, take: 5, orderBy: { dueDate: 'asc' } },
            proposals: { take: 3, orderBy: { createdAt: 'desc' } },
            customerSuccess: true,
            aiInsight: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          take: 50,
        },
      },
    });
  } else if (contactEmail || contactPhone || contactHandle) {
    conversation = await prisma.conversation.findFirst({
      where: {
        organizationId,
        OR: [
          ...(contactEmail ? [{ contactEmail }] : []),
          ...(contactPhone ? [{ contactPhone }] : []),
          ...(contactHandle ? [{ contactHandle }] : []),
        ],
      },
      include: {
        lead: {
          include: {
            tasks: { where: { completed: false }, take: 5, orderBy: { dueDate: 'asc' } },
            proposals: { take: 3, orderBy: { createdAt: 'desc' } },
            customerSuccess: true,
            aiInsight: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  // 2. Create if not found
  if (!conversation) {
    let lead: any = null;
    if (leadId) {
      lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId },
      });
    }

    const effectiveContactName =
      contactName || lead?.contactName || contactEmail || contactHandle || contactPhone || 'Customer Prospect';
    const defaultSubject =
      subject || (lead ? `Conversation with ${lead.contactName}${lead.companyName ? ` (${lead.companyName})` : ''}` : `Inquiry from ${effectiveContactName}`);

    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        leadId: lead?.id || null,
        contactName: effectiveContactName,
        contactEmail: contactEmail || lead?.email || null,
        contactPhone: contactPhone || lead?.phone || null,
        contactHandle: contactHandle || lead?.instagram || lead?.xHandle || null,
        channel: channel.toUpperCase(),
        primaryChannel: channel.toUpperCase(),
        subject: defaultSubject,
        assignedToId: assignedToId || lead?.assignedToId || undefined,
        status: 'OPEN',
        priority: 'NORMAL',
        lastMessageSnippet: 'Conversation opened',
      },
      include: {
        lead: {
          include: {
            tasks: { where: { completed: false }, take: 5, orderBy: { dueDate: 'asc' } },
            proposals: { take: 3, orderBy: { createdAt: 'desc' } },
            customerSuccess: true,
            aiInsight: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
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
 * Backward-compatible alias for getOrCreateConversation
 */
export async function getOrCreateLeadConversation(params: {
  organizationId: string;
  leadId: string;
  channel?: string;
  subject?: string;
  assignedToId?: string;
}) {
  return getOrCreateConversation(params);
}

/**
 * Dispatches an outbound message or saves an internal note.
 * Uses provider abstraction and enforces strict connection validation.
 */
export async function sendUnifiedMessage(params: SendUnifiedMessageParams) {
  const {
    organizationId,
    conversationId,
    senderId,
    senderName,
    channel,
    content,
    subject,
    isInternal = false,
    metadata,
    attachments,
  } = params;

  // 1. Verify conversation and tenant isolation
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { lead: true },
  });

  if (!conversation) {
    throw new Error('Conversation thread not found or unauthorized for this workspace');
  }

  const sentAt = new Date();

  // 2. Handle Internal Notes
  if (isInternal || channel === 'INTERNAL_NOTE') {
    const message = await prisma.conversationMessage.create({
      data: {
        conversationId,
        channel: 'INTERNAL_NOTE',
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        senderId: senderId || null,
        senderName: senderName || 'Team Member',
        content,
        contentType: 'NOTE',
        deliveryStatus: 'DELIVERED',
        status: 'DELIVERED',
        isInternal: true,
        sentAt,
        metadata: metadata ? metadata : undefined,
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

    return {
      success: true,
      deliveryStatus: 'DELIVERED',
      message,
      deliveryMode: 'INTERNAL',
    };
  }

  // 3. Resolve Destination Address for Customer Channel
  let recipientAddress = '';
  const lead = conversation.lead;

  if (channel === 'EMAIL') {
    recipientAddress = conversation.contactEmail || lead?.email || '';
  } else if (channel === 'WHATSAPP') {
    recipientAddress = conversation.contactPhone || lead?.phone || '';
  } else if (channel === 'INSTAGRAM') {
    recipientAddress = conversation.contactHandle || lead?.instagram || '';
  } else if (channel === 'FACEBOOK') {
    recipientAddress = conversation.contactHandle || lead?.facebook || '';
  } else if (channel === 'X') {
    recipientAddress = conversation.contactHandle || lead?.xHandle || '';
  } else if (channel === 'TIKTOK') {
    recipientAddress = conversation.contactHandle || lead?.tiktok || '';
  }

  // 4. Dispatch via Provider Abstraction
  const provider = providerRegistry.getProvider(channel);
  if (!provider) {
    throw new Error(`Channel provider for ${channel} is not registered in the system.`);
  }

  let threadMeta: Record<string, any> | undefined = metadata;
  let replySubject = subject;
  if (channel === 'EMAIL') {
    const lastInbound = await prisma.conversationMessage.findFirst({
      where: { conversationId, channel: 'EMAIL', direction: 'INBOUND' },
      orderBy: { sentAt: 'desc' },
    });
    const lastMeta = (lastInbound?.metadata || {}) as any;
    if (lastInbound?.externalMessageId) threadMeta = { ...(metadata || {}), inReplyTo: lastInbound.externalMessageId };
    if (!replySubject && lastMeta.subject) replySubject = /^re:/i.test(lastMeta.subject) ? lastMeta.subject : `Re: ${lastMeta.subject}`;
  }

  const input: SendMessageInput = {
    organizationId,
    conversationId,
    recipientAddress,
    recipientName: conversation.contactName || lead?.contactName,
    subject: replySubject || conversation.subject || undefined,
    content,
    senderId,
    senderName,
    metadata: threadMeta,
    attachments,
  };

  const dispatchResult = await provider.sendMessage(input);

  // If connection is required, return failure with explanation (DO NOT FAKE DELIVERY)
  if (!dispatchResult.success) {
    return {
      success: false,
      deliveryStatus: dispatchResult.deliveryStatus,
      errorMessage: dispatchResult.errorMessage,
      requiresConnection: dispatchResult.requiresConnection,
    };
  }

  // 5. Store message in database
  const message = await prisma.conversationMessage.create({
    data: {
      conversationId,
      channel,
      direction: 'OUTBOUND',
      senderType: 'AGENT',
      senderId: senderId || null,
      senderName: senderName || 'Account Executive',
      content,
      contentType: 'TEXT',
      externalMessageId: dispatchResult.externalMessageId || null,
      deliveryStatus: dispatchResult.deliveryStatus,
      status: dispatchResult.deliveryStatus,
      sentAt,
      isInternal: false,
      metadata: dispatchResult.metadata ? dispatchResult.metadata : undefined,
    },
  });

  // 6. Update conversation metadata
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: sentAt,
      lastMessageSnippet: content.slice(0, 80),
      channel,
      status: 'WAITING_ON_CUSTOMER',
    },
  });

  // 7. Synchronize with Lead and OutreachLog for historical continuity
  if (lead) {
    try {
      await prisma.$transaction([
        prisma.outreachLog.create({
          data: {
            leadId: lead.id,
            type: channel,
            subject: subject || conversation.subject || undefined,
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
      ]);
    } catch (err) {
      console.warn('Non-blocking outreach sync error:', err);
    }
  }

  return {
    success: true,
    deliveryStatus: dispatchResult.deliveryStatus,
    message,
    deliveryMode: channel,
  };
}

/**
 * Records an inbound message received from external webhooks or live channel gateways.
 * Includes deduplication, identity resolution, lead mapping, and in-app notifications.
 */
export async function recordInboundChannelMessage(params: {
  channel: CommunicationChannel;
  content: string;
  externalMessageId?: string;
  senderExternalId?: string;
  senderHandle?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  /** Required. Must come from an authenticated source (a verified connected account), never from request input. */
  organizationId: string;
  metadata?: any;
}) {
  const {
    channel,
    content,
    externalMessageId,
    senderExternalId,
    senderHandle,
    senderName,
    senderEmail: rawSenderEmail,
    senderPhone,
    organizationId,
    metadata,
  } = params;

  // 1. The workspace must be supplied by the caller (resolved from a verified connected account).
  // There is deliberately NO fallback to "any" or "the first" organization.
  const orgId = organizationId;
  if (!orgId) throw new Error('organizationId is required to record an inbound message');
  const senderEmail = rawSenderEmail ? rawSenderEmail.trim().toLowerCase() : undefined;

  // 2. Check for duplicate message (idempotency / deduplication), scoped to the workspace
  if (externalMessageId) {
    const existingMsg = await prisma.conversationMessage.findFirst({
      where: { externalMessageId, conversation: { organizationId: orgId } },
      include: { conversation: true },
    });
    if (existingMsg) {
      return { conversation: existingMsg.conversation, message: existingMsg, isDuplicate: true };
    }
  }

  // 3. Identity Resolution across Channel Identities and Leads
  let lead: any = null;

  // Step 3a: Check ContactChannelIdentity mapping
  if (senderExternalId) {
    const identity = await prisma.contactChannelIdentity.findUnique({
      where: {
        organizationId_channel_externalUserId: {
          organizationId: orgId,
          channel,
          externalUserId: senderExternalId,
        },
      },
      include: { lead: true },
    });
    if (identity?.lead) {
      lead = identity.lead;
    }
  }

  // Step 3b: Match Lead by email
  if (!lead && senderEmail) {
    lead = await prisma.lead.findFirst({
      where: { organizationId: orgId, email: senderEmail },
    });
  }

  // Step 3c: Match Lead by phone
  if (!lead && senderPhone) {
    const cleanPhone = normalizePhone(senderPhone);
    lead = await prisma.lead.findFirst({
      where: { organizationId: orgId, phone: { contains: cleanPhone.slice(-8) } },
    });
  }

  // Step 3d: Match Lead by social handle
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

  // Step 3e: If lead resolved and external identity is available, store/update identity mapping
  if (lead && senderExternalId) {
    try {
      await prisma.contactChannelIdentity.upsert({
        where: {
          organizationId_channel_externalUserId: {
            organizationId: orgId,
            channel,
            externalUserId: senderExternalId,
          },
        },
        update: {
          username: senderHandle || undefined,
          displayName: senderName || undefined,
          updatedAt: new Date(),
        },
        create: {
          organizationId: orgId,
          leadId: lead.id,
          channel,
          externalUserId: senderExternalId,
          username: senderHandle || null,
          displayName: senderName || null,
        },
      });
    } catch (e) {
      console.warn('Non-blocking identity mapping notice:', e);
    }
  }

  // 4. Find or Create Conversation
  const effectiveContactName = senderName || senderHandle || (senderPhone ? `Phone ${senderPhone}` : senderEmail || `Prospect (${channel})`);

  const conversation = await getOrCreateConversation({
    organizationId: orgId,
    leadId: lead?.id || null,
    contactName: effectiveContactName,
    contactEmail: senderEmail || lead?.email || undefined,
    contactPhone: senderPhone || lead?.phone || undefined,
    contactHandle: senderHandle || undefined,
    channel,
    subject: `Inbound ${channel} conversation with ${effectiveContactName}`,
  });

  const sentAt = new Date();

  // 5. Store inbound message
  const message = await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      channel,
      direction: 'INBOUND',
      senderType: 'CUSTOMER',
      senderId: senderExternalId || null,
      senderName: effectiveContactName,
      senderExternalId: senderExternalId || null,
      content,
      contentType: 'TEXT',
      externalMessageId: externalMessageId || null,
      deliveryStatus: 'DELIVERED',
      status: 'DELIVERED',
      sentAt,
      receivedAt: sentAt,
      isInternal: false,
      metadata: metadata ? metadata : undefined,
    },
  });

  // 6. Update conversation state
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      lastMessageSnippet: `[${channel}] ${content.slice(0, 70)}`,
      status: 'WAITING_ON_US',
      isClosed: false,
      unreadCount: { increment: 1 },
      channel,
    },
  });

  // 7. Update Lead outreach status if linked
  if (lead) {
    try {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContact: sentAt,
          outreachStatus: 'REPLIED',
          pipelineStage: ['NEW_LEAD', 'RESEARCHING', 'CONTACTED'].includes(lead.pipelineStage)
            ? 'FOLLOW_UP'
            : lead.pipelineStage,
        },
      });
    } catch (e) {
      console.warn('Non-blocking lead stage update notice:', e);
    }
  }

  // 8. Trigger in-app Notification for assigned rep or workspace admin
  try {
    const notifyUserId = conversation.assignedToId || (
      await prisma.user.findFirst({
        where: { organizationId: orgId, role: 'ADMIN' },
      })
    )?.id;

    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: 'INBOUND_MESSAGE',
          title: `New ${channel} message from ${effectiveContactName}`,
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
 * Simulates receiving an inbound reply from a lead.
 * Useful for automated tests and QA validation.
 */
export async function simulateInboundMessage(params: {
  organizationId: string;
  conversationId: string;
  content: string;
  channel?: CommunicationChannel;
}) {
  const { organizationId, conversationId, content, channel = 'WHATSAPP' } = params;

  // Simulation is a demo/QA tool. It is disabled in production unless explicitly enabled.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INBOX_SIMULATION !== 'true') {
    throw new Error('Inbound simulation is disabled in production.');
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { lead: true },
  });

  if (!conversation) throw new Error('Conversation not found');

  return recordInboundChannelMessage({
    channel,
    content,
    organizationId: conversation.organizationId,
    senderName: conversation.contactName || conversation.lead?.contactName || 'Test Prospect',
    senderEmail: conversation.contactEmail || conversation.lead?.email || undefined,
    senderPhone: conversation.contactPhone || conversation.lead?.phone || undefined,
    senderHandle: conversation.contactHandle || undefined,
  });
}

/**
 * Retrieves all connected social channel accounts for an organization.
 * Sensitive tokens are sanitized for client display.
 */
export async function getConnectedChannelAccounts(organizationId: string, opts: { includeWebhookSecret?: boolean } = {}) {
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
    webhookSecret: opts.includeWebhookSecret ? acc.webhookSecret : null,
    lastSyncAt: acc.lastSyncAt,
    errorMessage: acc.errorMessage,
    connectedAt: acc.connectedAt,
    updatedAt: acc.updatedAt,
  }));
}

class ChannelOwnershipError extends Error {
  status = 400;
}

/**
 * Inbound webhooks are routed to a workspace by the provider's account ID, so a workspace
 * must never be able to claim an ID it does not own (it would receive another
 * workspace's customer messages).
 */
async function assertChannelOwnership(
  organizationId: string,
  channel: string,
  accountHandle: string,
  externalAccountId: string,
  accessToken?: string | null
) {
  const taken = await prisma.connectedChannelAccount.findFirst({
    where: { channel, externalAccountId, organizationId: { not: organizationId } },
    select: { id: true },
  });
  if (taken) throw new ChannelOwnershipError('This account is already connected to another workspace.');

  if (!['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(channel)) return;
  let token = accessToken || null;
  if (!token) {
    const existing = await prisma.connectedChannelAccount.findFirst({
      where: { organizationId, channel, accountHandle },
      select: { accessToken: true },
    });
    token = decryptSecret(existing?.accessToken);
  }
  if (!token) throw new ChannelOwnershipError('An access token is required to verify this account.');
  // The token must be able to read the ID it claims: proves the workspace controls it.
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
  const res = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(externalAccountId)}?fields=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => null);
  if (!res?.ok) throw new ChannelOwnershipError('Could not verify this account ID with the access token provided.');
}

/**
 * Connects or updates a communication channel account with credentials.
 */
export async function upsertConnectedChannelAccount(params: {
  organizationId: string;
  channel: string;
  accountName: string;
  accountHandle: string;
  externalAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
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
    tokenExpiresAt,
    appId,
    appSecret,
    webhookSecret,
    avatarUrl,
    metadata,
  } = params;

  if (externalAccountId) await assertChannelOwnership(organizationId, channel, accountHandle, externalAccountId, accessToken);

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
      accessToken: encryptSecret(accessToken) || undefined,
      refreshToken: encryptSecret(refreshToken) || undefined,
      tokenExpiresAt: tokenExpiresAt || undefined,
      appId: appId || undefined,
      appSecret: encryptSecret(appSecret) || undefined,
      webhookSecret: webhookSecret || undefined,
      status: 'CONNECTED',
      lastSyncAt: new Date(),
      errorMessage: null,
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
      accessToken: encryptSecret(accessToken),
      refreshToken: encryptSecret(refreshToken),
      tokenExpiresAt: tokenExpiresAt || null,
      appId: appId || null,
      appSecret: encryptSecret(appSecret),
      webhookSecret: webhookSecret || generateWebhookSecret(),
      status: 'CONNECTED',
      lastSyncAt: new Date(),
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

