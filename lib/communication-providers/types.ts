export type CommunicationChannel =
  | 'EMAIL'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'X'
  | 'TIKTOK'
  | 'INTERNAL_NOTE';

export type DeliveryStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export type MessageSenderType =
  | 'CUSTOMER'
  | 'AGENT'
  | 'SYSTEM'
  | 'USER'
  | 'AI_COPILOT'
  | 'LEAD';

export interface SendMessageInput {
  organizationId: string;
  conversationId: string;
  recipientAddress?: string; // email, phone, social handle, external ID
  recipientName?: string;
  subject?: string;
  content: string;
  senderId?: string;
  senderName?: string;
  isInternal?: boolean;
  metadata?: Record<string, any>;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
}

export interface SendMessageResult {
  success: boolean;
  deliveryStatus: DeliveryStatus;
  externalMessageId?: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  requiresConnection?: boolean;
}

export interface WebhookValidationResult {
  isValid: boolean;
  challengeResponse?: string;
  error?: string;
}

export interface InboundParsedMessage {
  channel: CommunicationChannel;
  externalMessageId?: string;
  externalSenderId?: string;
  senderHandle?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  content: string;
  sentAt?: Date;
  metadata?: Record<string, any>;
  attachments?: any[];
}

export interface ChannelConnectionStatus {
  channel: CommunicationChannel;
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  displayName: string;
  accountName?: string | null;
  accountHandle?: string | null;
  externalAccountId?: string | null;
  lastSyncAt?: Date | null;
  errorMessage?: string | null;
  setupInstructions: string;
  requiresCredentials: string[];
}

export interface CommunicationProvider {
  channel: CommunicationChannel;
  displayName: string;

  /**
   * Checks if this provider is configured and operational for the organization.
   */
  getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus>;

  /**
   * Dispatches an outbound message to the external recipient.
   * If not configured, returns a clean error without pretending delivery.
   */
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;

  /**
   * Validates webhook signatures / challenges from the provider.
   */
  validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult>;

  /**
   * Parses inbound webhook payload into normalized message structures.
   */
  parseWebhookPayload(bodyText: string, headers?: Headers): Promise<InboundParsedMessage[]>;
}
