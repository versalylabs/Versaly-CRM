# Phase 18: Unified Communication Inbox

## 1. System Overview & Core Philosophy

The **Unified Communication Inbox** is a centralized omnichannel communication hub built for Versaly CRM. It aggregates and unifies conversations with prospective leads, current clients, and external accounts across six major channels:
- **Email** (SMTP / Inbound webhook)
- **WhatsApp** (Meta WhatsApp Business Cloud API)
- **Instagram Direct** (Meta Graph API)
- **Facebook Messenger** (Meta Graph API)
- **X / Twitter** (X API v2 Direct Messages)
- **TikTok** (TikTok for Business IM API)
- **Internal Notes** (CRM user internal remarks)

Every message and conversation is strictly **tenant-isolated** (`organizationId`), mapped to CRM Leads through a dedicated **Channel Identity System** (`ContactChannelIdentity`), and dispatched via an extensible **Provider Abstraction Layer**.

---

## 2. Channel Readiness & Status Matrix

Versaly CRM enforces an **honesty principle**: external communication channels do not fake mock successful deliveries when credentials are not configured.

| Channel | Implementation State | Required Production Credentials | Delivery Mode |
|---|---|---|---|
| **Email** | **IMPLEMENTED** (Production Ready) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Live SMTP via Nodemailer & Inbound Parse Webhook |
| **Internal Notes** | **IMPLEMENTED** (Production Ready) | Built-in (Workspace Authenticated) | Stored securely in CRM, visible only to team members |
| **WhatsApp** | **SCAFFOLDED & INTEGRATED** | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | Dispatches via Meta Graph API v21.0 or reports "Not Connected" |
| **Instagram** | **SCAFFOLDED & INTEGRATED** | Meta Page Access Token with `instagram_manage_messages` permission | Dispatches via Meta Graph API v21.0 or reports "Not Connected" |
| **Facebook** | **SCAFFOLDED & INTEGRATED** | Meta Facebook Page Access Token, `FACEBOOK_PAGE_ID` | Dispatches via Meta Graph API v21.0 or reports "Not Connected" |
| **X (Twitter)** | **SCAFFOLDED & INTEGRATED** | X API v2 Bearer Token / OAuth 2.0 User Context | Dispatches via X API v2 Direct Messages or reports "Not Connected" |
| **TikTok** | **SCAFFOLDED & INTEGRATED** | TikTok Business Open API Access Token, `TIKTOK_APP_ID` | Dispatches via TikTok Business IM API or reports "Not Connected" |

---

## 3. Architecture & Data Flow

```
                                    +------------------------------+
                                    |     External Inbound Webhook  |
                                    | (Meta / X / TikTok / Email)  |
                                    +--------------+---------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               | /api/webhooks/communications/[channel]|
                               +-------------------+-------------------+
                                                   |
                        +--------------------------+--------------------------+
                        |                                                     |
                        v                                                     v
             [Webhook Authentication]                               [Payload Normalization]
             (Token / CRC / Signature)                             (InboundParsedMessage)
                        |                                                     |
                        +--------------------------+--------------------------+
                                                   |
                                                   v
                                    [Identity Resolution Layer]
                        1. ContactChannelIdentity lookup (channel + externalId)
                        2. Lead lookup by email, phone, or social handle
                        3. If unmatched -> create Unknown Contact Conversation
                                                   |
                                                   v
                                    [Database Persistence & Sync]
                        - Upsert Conversation (unreadCount + 1, lastSnippet)
                        - Insert ConversationMessage (direction: INBOUND)
                        - Update Lead (outreachStatus: REPLIED)
                        - In-app Notification to assigned rep
                                                   |
                                                   v
                                    +------------------------------+
                                    |    Unified Inbox UI (/inbox) |
                                    +------------------------------+
```

---

## 4. Database Schema Specifications

### `Conversation`
- `id`: Unique identifier (UUID).
- `organizationId`: Multi-tenant workspace reference.
- `leadId`: Nullable reference to CRM `Lead` (supports unknown external contacts).
- `contactName`, `contactEmail`, `contactPhone`, `contactHandle`: Denormalized contact details.
- `channel`, `primaryChannel`: Primary communication medium.
- `status`: Lifecycle stage (`OPEN`, `WAITING_ON_US`, `WAITING_ON_CUSTOMER`, `CLOSED`).
- `priority`: Urgency rating (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
- `assignedToId`: Assigned team member reference.
- `unreadCount`: Counter for unread messages.
- `isStarred`, `isArchived`, `isClosed`: Workspace flags.
- `lastMessageAt`, `lastMessageSnippet`: Indexable preview fields.

### `ConversationMessage`
- `id`: Unique identifier (UUID).
- `conversationId`: Parent conversation reference.
- `channel`: Origin medium (`EMAIL`, `WHATSAPP`, `INSTAGRAM`, `FACEBOOK`, `X`, `TIKTOK`, `INTERNAL_NOTE`).
- `direction`: Directionality (`INBOUND`, `OUTBOUND`).
- `senderType`: Actor category (`AGENT`, `LEAD`, `CUSTOMER`, `USER`, `SYSTEM`).
- `senderId`, `senderName`, `senderExternalId`: Sender metadata.
- `content`, `contentType`: Payload (`TEXT`, `NOTE`, `HTML`, `MEDIA`).
- `externalMessageId`: External provider message ID (used for deduplication).
- `deliveryStatus`: Delivery state (`DRAFT`, `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- `isInternal`: Flag distinguishing internal notes from customer communications.

### `ContactChannelIdentity`
- `organizationId`, `leadId`, `channel`, `externalUserId`: Cross-platform identity resolution.
- `username`, `displayName`, `profileUrl`, `metadata`: Cached profile info.
- `@@unique([organizationId, channel, externalUserId])`: Enforces 1:1 mapping per external ID.

### `ConnectedChannelAccount`
- Stores workspace-specific API credentials, access tokens, webhook verification tokens, and synchronization states for social integrations.

---

## 5. API Endpoints Reference

### Conversations
- `GET /api/inbox/conversations`
  - Supports filters: `folder` (`all`, `unread`, `assigned_to_me`, `unassigned`, `starred`, `archived`, `closed`), `channel`, `status`, `priority`, `query` (search).
  - Returns paginated conversations list and folder counters.
- `GET /api/inbox/conversations/[id]`
  - Returns complete conversation, messages, associated lead context (tasks, proposals, customer success, sentiment), and channel connection status. Resets unread counter.
- `PATCH /api/inbox/conversations/[id]`
  - Updates status, priority, star state, archived state, or subject.
- `POST /api/inbox/conversations`
  - Creates or retrieves an existing conversation thread for a lead or contact.

### Messaging & Actions
- `GET /api/inbox/conversations/[id]/messages`
  - Retrieves chronological conversation messages.
- `POST /api/inbox/conversations/[id]/messages`
  - Sends an outbound omnichannel message or records an internal note.
- `POST /api/inbox/conversations/[id]/read`
  - Marks conversation as read or unread.
- `POST /api/inbox/conversations/[id]/assign`
  - Assigns or unassigns conversation to team members within the same organization.
- `POST /api/inbox/conversations/[id]/notes`
  - Records an internal team note.
- `POST /api/inbox/conversations/[id]/tasks`
  - Schedules a follow-up task directly from a conversation.
- `POST /api/inbox/conversations/[id]/convert-lead`
  - Converts an unknown contact conversation into a CRM Lead.

### Channel Integrations
- `GET /api/inbox/channels`
  - Returns connection status for all 6 providers and connected accounts (secrets sanitized).
- `POST /api/inbox/channels`
  - Connects or updates channel credentials.
- `DELETE /api/inbox/channels?id=[id]`
  - Disconnects a channel.

### Webhooks
- `GET /api/webhooks/communications/[channel]`
  - Handles verification challenges (Meta hub.challenge, X crc_token).
- `POST /api/webhooks/communications/[channel]`
  - Processes inbound messages from external providers.

---

## 6. Environment Variables

```env
# Email / SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE="false"
SMTP_USER="notifications@versaly.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="Versaly CRM <notifications@versaly.com>"
EMAIL_WEBHOOK_SECRET="optional-webhook-secret"

# Meta (WhatsApp Cloud, Instagram Direct, Facebook Messenger)
META_WEBHOOK_VERIFY_TOKEN="whsec_meta_crm_verification"
META_GRAPH_API_VERSION="v21.0"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_ACCESS_TOKEN="your_meta_system_user_token"
FACEBOOK_PAGE_ACCESS_TOKEN="your_facebook_page_token"
FACEBOOK_PAGE_ID="your_facebook_page_id"
INSTAGRAM_ACCESS_TOKEN="your_instagram_token"

# X (Twitter)
X_BEARER_TOKEN="your_x_api_bearer_token"
X_API_SECRET="your_x_consumer_secret"

# TikTok for Business
TIKTOK_ACCESS_TOKEN="your_tiktok_business_token"
TIKTOK_APP_ID="your_tiktok_app_id"
TIKTOK_APP_SECRET="your_tiktok_app_secret"
```

---

## 7. How to Test the Unified Inbox

1. **Folder & Channel Filtering**:
   - Navigate to `/inbox`.
   - Click through folders: All, Unread, Assigned to Me, Starred, Archived, Closed.
   - Filter by channel: Email, WhatsApp, Instagram, Facebook, X, TikTok.

2. **Internal Team Notes**:
   - Open any conversation.
   - Switch the composer mode toggle to **🔒 Internal Note**.
   - Type a note and click **Add Internal Note**.
   - Notice the distinct warm amber styling and lock icon indicating the message is private to CRM agents.

3. **Honest Channel Connection Handling**:
   - Select a channel that is not connected (e.g., WhatsApp without credentials).
   - Observe the clear warning banner: `WhatsApp isn't connected. Connect credentials to send live messages from this channel.`
   - Click the **Connect WhatsApp** button to navigate to the configuration modal.

4. **Unknown Contact Lead Conversion**:
   - Inbound messages from unknown contacts show an **Unknown Contact** badge.
   - Click **+ Convert to CRM Lead** in the intelligence panel.
   - The contact is instantly promoted to a Lead in your pipeline without creating duplicate entries.

5. **Channel Settings**:
   - Navigate to `/settings/integrations`.
   - View all 6 channels, their connection state, setup instructions, and copyable webhook endpoints.
