# Phase 19 — Omnichannel Unified Inbox

Phase 19 introduces a central, Slack/Intercom-grade **Omnichannel Unified Inbox** to Versaly CRM. It consolidates interactions with prospects and customers across **Email, WhatsApp, SMS, and private internal team notes** into a synchronized, real-time conversational workspace.

---

## Capabilities & Architecture

### 1. Multi-Tenant Prisma Data Models
- **`Conversation`**:
  - Scoped to `Organization` and `Lead`.
  - Tracks thread status (`OPEN`, `WAITING_ON_CUSTOMER`, `WAITING_ON_US`, `CLOSED`, `SNOOZED`).
  - Stores `lastMessageAt`, `lastMessageSnippet`, `unreadCount`, assigned team member (`assignedTo`), and primary channel (`EMAIL`, `WHATSAPP`, `SMS`).
- **`ConversationMessage`**:
  - Belongs to `Conversation` (cascade on delete).
  - Tracks `senderType` (`AGENT`, `LEAD`, `SYSTEM`, `AI_COPILOT`), `senderName`, `channel`, `content`, `metadata` (provider delivery payload or simulated flags), and `status` (`SENT`, `DELIVERED`, `READ`, `FAILED`).
  - Supports private **`isInternal` team collaboration notes** that remain completely invisible to the customer.

### 2. Unified Communications Engine (`lib/inbox.ts`)
- **Multi-Channel Dispatcher**:
  - **WhatsApp**: Dispatches via Meta WhatsApp Cloud API if configured (`WHATSAPP_PHONE_NUMBER_ID` & `WHATSAPP_ACCESS_TOKEN`); gracefully records in CRM if unconfigured.
  - **Email**: Dispatches via SMTP nodemailer if configured; gracefully records in CRM if unconfigured.
  - **Internal Notes**: Posts highlighted team-only collaboration notes directly in the timeline.
- **Lock-Step Synchronization**:
  - Outbound messages automatically create corresponding `OutreachLog` records and update `Lead.lastContact` and `Lead.outreachStatus`, keeping existing analytics, activity feeds, and Phase 18 AI Deal Copilot models in exact synchronization.
- **AI Smart Reply Recommendation Engine**:
  - Analyzes lead sentiment, deal stage, and recent message topics to produce 3 clickable, high-converting quick response recommendations.
- **Inbound Simulation Engine**:
  - Allows 1-click simulation of incoming replies from leads across WhatsApp or Email for testing, QA verification, and sales team training.

### 3. Backend API Route Handlers
- **`GET /api/inbox/conversations`**: Lists conversations with filters (`status`, `channel`, `assigned`, `search query`) and folder unread counters.
- **`POST /api/inbox/conversations`**: Starts or retrieves a thread for any lead in the organization.
- **`GET /api/inbox/conversations/[id]`**: Retrieves full message history and lead CRM dossier; automatically resets unread count.
- **`PATCH /api/inbox/conversations/[id]`**: Updates conversation state (`OPEN` / `CLOSED`), assignment, or unread counter.
- **`POST /api/inbox/conversations/[id]/messages`**: Dispatches outbound email/WhatsApp or posts internal notes.
- **`GET /api/inbox/conversations/[id]/smart-replies`**: Generates 3 contextual AI reply pills.
- **`POST /api/inbox/simulate`**: Simulates incoming customer message to test reactivity.

### 4. Interactive Command Center (`/inbox`)
- **3-Column Intercom-Grade Workspace**:
  - **Pane 1 (Folders & Channels)**: All Inboxes, Unread, Open, Awaiting Client, Closed, and channel filters (WhatsApp, Email, SMS).
  - **Pane 2 (Thread List)**: Searchable list with contact name, company, channel indicator, time ago, unread badge, and Phase 18 sentiment/win probability pills.
  - **Pane 3 (Live Message Stream & Smart Composer)**:
    - Thread header with lead details, stage badge, deal value, status toggle, and "Simulate Reply" launcher.
    - Chronological stream differentiating Agent messages, Lead messages, and amber-highlighted Internal Notes.
    - AI Copilot smart reply recommendation bar (1-click to populate composer).
    - Multi-channel composer with Email/WhatsApp toggle, canned response library, and keyboard shortcut (`Ctrl+Enter`).

### 5. Navigation & Shortcuts
- Added **Unified Inbox** to `src/components/sidebar.tsx` under `Communications` with a vector SVG outline inbox icon.
- Added **Unified Inbox** shortcut button in `src/app/leads/[id]/page.tsx` header and Quick Actions menu.

---

## Verification & QA
- **Prisma Push**: SQLite `dev.db` synchronized with `Conversation` and `ConversationMessage`.
- **Structural QA**: `npm run qa:final` passing 117/117 checks.
- **Type Safety**: `npx tsc --noEmit` verified with 0 errors.
- **Production Build**: `npm run build` compiled all routes cleanly.
