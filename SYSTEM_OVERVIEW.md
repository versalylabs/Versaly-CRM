# Versaly CRM — System Overview

_Last updated: 2026-11-17. This is the single reference document for what Versaly CRM is, what it does today, how it is built, and how it is deployed. For the security/quality audit and the roadmap to market readiness see [`PRODUCT_AUDIT_AND_RECOMMENDATIONS.md`](./PRODUCT_AUDIT_AND_RECOMMENDATIONS.md)._

> **Security note:** earlier versions of this document listed admin credentials. They have been removed. Credentials must never be stored in documentation or source control. Any credential that appeared in a previous version should be treated as compromised and rotated.

---

## 1. What it is

**Versaly CRM** is a multi-tenant SaaS customer-relationship-management platform for small and mid-sized service businesses and sales teams. It combines lead and deal management, a communications hub, task/calendar management, automation, proposals, customer-success tracking and reporting. Each customer gets an isolated **workspace (organization)** with its own users, data, plan and settings.

Brand: **Versaly Labs**. Default currency: KES (workspaces can pick USD, KES, EUR, GBP, ZAR, CAD, AUD).

## 2. Deployment & infrastructure

| Attribute | Detail |
| :-- | :-- |
| Live URL | https://versaly-crm.vercel.app |
| Hosting | Vercel (serverless, Node runtime) |
| Database | Managed PostgreSQL via Prisma Postgres (Vercel integration) |
| Repository | GitHub `versalylabs/Versaly-CRM`, branch `main` |
| Framework | Next.js 14.2.5 (App Router), React 18.3, TypeScript 5.5 |
| Styling / UI | Tailwind CSS 3, framer-motion, lucide-react; custom "Glorase" display font + Inter |
| Auth | NextAuth v4, Credentials provider, JWT sessions (8 h) |
| ORM | Prisma 6.19 |
| Payments | Stripe (Checkout, Billing Portal, webhooks) |
| Email | Nodemailer over SMTP |
| Health check | `GET /api/health` (and `/api/health/live`) |

Environment variables (see `.env.example`): `DATABASE_URL` (or Vercel's `PRISMA_DATABASE_POSTGRES_URL`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `INVITATION_SECRET`, `SMTP_*`, `STRIPE_*` (secret, webhook secret, publishable key, monthly/annual price IDs per plan), `PLATFORM_ADMIN_EMAILS`, `CRON_SECRET`, `META_*` / `WHATSAPP_*` (optional channel credentials), `LEAD_CAPTURE_API_KEY`, `RATE_LIMIT_STORE`.

Build pipeline: `npm run build` → `scripts/db-sync.js` (runs a **non-destructive** `prisma db push`; the build fails rather than dropping data; no accounts are seeded) → `next build`. The Prisma provider is fixed to PostgreSQL, so local development needs a Postgres database too. See the audit document for the recommended move to proper Prisma migrations.

Security-relevant variables: `NEXTAUTH_SECRET` is **required** (no fallback), `CHANNEL_ENCRYPTION_KEY` encrypts stored channel credentials, `PLATFORM_ORG_SLUG` names the workspace allowed to use platform-level channel credentials from the environment, `ALLOW_INBOX_SIMULATION` enables the demo "simulate reply" tool in production (default off).

Quality tooling: `npm run qa:final` (structural checks), `npm run qa:smoke` (live smoke test), `npm run production:check`, `npx tsc --noEmit` (currently clean).

## 3. Roles & multi-tenancy

- **Organization (workspace)** — owns users, leads, tasks, proposals, calendar, workflows, API keys, webhooks, conversations, channel accounts and pipeline configuration. Carries plan, plan status, limits, currency and suspension state.
- **Roles** — `ADMIN`, `MANAGER`, `AGENT` (per workspace). Managers/admins see team-wide data; agents see their own assignments (e.g. calendar).
- **Platform administrators** — Versaly staff listed in `PLATFORM_ADMIN_EMAILS`; access `/platform` to manage all workspaces, support, audit logs and automations.
- **Team management** — admins invite users by signed, expiring invitation links, set roles, activate/deactivate users and enforce seat limits.

## 4. Feature catalogue

### 4.1 Public website
- Landing page (hero, bento feature grid, pipeline visualizer, testimonials/metrics, pricing, FAQ, contact section, footer with phone and social links).
- Pricing section with monthly/annual toggle and plan hand-off to signup (`/auth/signup?plan=…`).
- Contact form → emails the Versaly team and ingests the enquiry as a lead with an onboarding follow-up task.
- Public lead form endpoint for embedding on external websites.

### 4.2 Account, onboarding & settings
- Self-service signup creating a workspace + admin + 14-day trial (no card required), with welcome email and an onboarding checklist of tasks. New workspaces start empty.
- Sign-in / sign-out, auth error screen, invite acceptance flow.
- Settings: profile, password change, workspace currency, notification preferences, pipeline configuration, billing and channel integrations.
- Global search and a command palette (`Ctrl/⌘ K`) across leads, tasks, proposals, calendar and outreach.
- In-app notifications (bell + notifications page) with per-type preferences; follow-up and task alerts.
- Light/dark theme and responsive layout with a mobile drawer.

### 4.3 Leads
- Lead records: contact, company, job title, email, phone, website, location, business type, social handles (Instagram, LinkedIn, Facebook, TikTok, X), source, deal value, last contact, next follow-up, notes, owner.
- Filtering by stage, source, assignee and search; per-lead detail page with timeline/activity, outreach history, tasks, proposals and calendar items.
- Lead sources: referral, cold outreach, social media, website form, event, other.
- Plan-based lead quota enforcement; duplicate detection per workspace by email.
- Automatic lead capture: website form, secure public API, Meta (Facebook/Instagram) Lead Ads webhook, and the authenticated developer API; new external leads are auto-assigned (round-robin by workload) and get a "respond within 24 h" task.

### 4.4 Deals pipeline
- Drag-and-drop Kanban board.
- Default stages: New Lead, Researching, Contacted, Follow-up, Interested, Proposal, Won, Lost.
- **Custom pipeline stages** (Settings → Pipeline): add, edit, reorder, recolor and delete stages; each stage has a probability and a category (Active / Won / Lost).
- Stage-change activity logging and automation triggers; pipeline value and conversion figures.

### 4.5 Tasks
- Create/assign/prioritise (low/medium/high) tasks with due dates, linked to leads; complete/reopen; overdue/today views.
- Assignment notifications; completion fires the `TASK_COMPLETED` automation trigger.

### 4.6 Calendar
- Month/week/agenda views with an upcoming-events sidebar and diagonal weekend styling.
- Event types: meeting, call, follow-up, property viewing, other; link to leads, locations, reminders, assignees, completion state.
- Role-aware visibility (agents see their events; managers see the team's) and external calendar sync support.

### 4.7 Communications
- **Outreach** — log and track outreach (email, call, SMS, LinkedIn…) with status (pending, sent, opened, clicked, replied, bounced).
- **Email** — compose and send email to leads over SMTP with reusable templates; sends are logged to the lead's timeline.
- **WhatsApp** — WhatsApp Cloud API sending screen and configuration status.
- **Unified Inbox** (`/inbox`) — a simple two-pane inbox: conversation list (All / Mine / Unassigned, Open / Done, search) and a thread with reply, private team notes, assignment, quick replies, mark done, "Add as lead" and a details panel. **Email** is connected by the workspace admin with an address and app password (IMAP + SMTP detected automatically, verified and encrypted); new mail is fetched while the inbox is open and by the daily cron, and replies are sent from the workspace's own address with proper threading. **WhatsApp** connects through the guided setup in Settings → Integrations (Meta Cloud API; signed webhooks). Instagram/Facebook are coming soon; TikTok and X are not offered.
- Outbound messages automatically sync to the lead's outreach log, last-contact date and stage.

### 4.8 Proposals
- Create proposals tied to a lead with title, description, value and status (draft, sent, accepted, rejected); status changes update the lead's stage and notify owners/managers.

### 4.9 Automation
- Workflow builder: **Triggers** — lead created, lead stage changed, lead updated, task created, task completed, activity created, outreach sent, outreach replied, lead inactive. **Actions** — create task, update stage, assign user, add note, send email, create activity, set follow-up.
- Idempotent executions with a run log, per-plan monthly automation run limits, manual run, and a scheduled endpoint (`POST /api/automation/cron`, protected by `CRON_SECRET`) for time-based rules such as inactive leads.

### 4.10 AI Deal Copilot (rule-based "smart assistant")
- Deal insights (sentiment, win probability, churn risk, buying signals, objections, suggested next actions), draft generation for follow-ups/proposals, meeting-note summarisation (transcript → summary, action items, decisions), portfolio overview.
- Currently heuristic/rule-driven rather than backed by a language model (see audit §2 for the recommendation).

### 4.11 Customer Success
- Post-sale tracking: lifecycle stage (onboarding → adopting → active → at risk → renewal → churned), health score and status, renewal date/value/status, success owner, review dates, notes, milestones with due dates.
- Auto-escalation tasks for at-risk, high-value accounts.

### 4.12 Dashboard, activity & reports
- Dashboard: KPI cards with dynamically computed trends, weekly activity, tasks due, recent leads/outreach/proposals, team workload (managers), clean zero-states for new workspaces.
- Activity feed: unified chronological feed of lead, outreach, task and proposal events.
- Reports: pipeline, conversion, source performance, revenue and team metrics with CSV export and print/PDF.

### 4.12a M-Pesa payments from customers (`/payments`)
- Each workspace connects its own Paybill or Till with Safaricom Daraja keys (sandbox first, then production). Keys are verified with Safaricom and stored encrypted.
- From a customer's **Payments** tab: send an M-Pesa prompt (STK Push) or create a pay link (`/pay/<token>`, works on any phone); status updates live and is logged on the timeline. Every customer gets a short account number for paying the Paybill directly.
- Money paid straight to the Paybill/Till is matched automatically (account number → phone → a single open request of the same amount); anything else waits in the **Unmatched** queue for one-click assignment.
- Payments page: received today / this month, outstanding and overdue instalments, debtor ageing, transactions with CSV export, M-Pesa settings.
- **Instalment plans** (Growth Pro+): deposit plus N weekly/monthly instalments, payments applied oldest-first, reminders by email or WhatsApp with a pay link (3 days before, on the day, 1 and 7 days late).
- Automation triggers: payment received, instalment overdue, plan fully paid. Outbound webhook event `payment.received`.
- Plan limits: Solo 30 requests/month and 1 shortcode; Starter adds auto-matching; Growth Pro 3 shortcodes and instalments; Enterprise unlimited.

### 4.13 Billing & subscriptions
- Plans: **Starter** ($29/mo), **Growth Pro** ($79/mo), **Enterprise Scale** ($199/mo); annual billing discount.
- 14-day trial; read-only mode when the trial expires, a payment is past due, or the subscription is cancelled; workspace suspension by platform staff.
- Stripe Checkout, Billing Portal, plan changes, and a signature-verified, idempotent webhook that syncs plan, status, period end and limits.
- Quotas: leads, team seats, automation runs.

### 4.14 Integrations & developer platform
- **Developer API** — workspace API keys (hashed, revocable, optional expiry), `POST/GET /api/v1/leads`.
- **Outbound webhooks** — HMAC-signed events with delivery log and failure counts.
- **Inbound** — public lead form, secure lead webhook, Meta Lead Ads webhook, communications webhooks.
- Channel connection screen (Settings → Integrations) for Email/WhatsApp/Meta/TikTok/X credentials.

### 4.15 Support desk
- In-app support tickets (category, priority, status, threaded messages, internal notes) for customers; staff handle them in the platform console.

### 4.16 Platform administration (`/platform`)
- Cross-workspace overview (organizations, MRR/ARR estimate, trial and cancellation rates), organization management (plan, status, suspension), support queue, automation monitor and audit log.

## 5. Data model (Prisma)

Core tenant: `Organization`, `User`, `Session`, `Notification`, `NotificationPreference`, `PipelineStageConfig`.
CRM: `Lead`, `OutreachLog`, `Task`, `CalendarEvent`, `Proposal`, `ActivityEvent`, `EmailTemplate`.
Automation: `AutomationWorkflow`, `AutomationExecution`.
Customer success & AI: `CustomerSuccessRecord`, `CustomerMilestone`, `AiDealInsight`, `AiMeetingSummary`.
Inbox: `Conversation`, `ConversationMessage`, `ContactChannelIdentity`, `ConnectedChannelAccount`.
Platform & billing: `SupportTicket`, `SupportMessage`, `PlatformAuditLog`, `ProcessedWebhookEvent`, `ApiKey`, `WebhookEndpoint`, `WebhookDelivery`.

## 6. Code layout

```
src/app/            Next.js App Router pages + src/app/api/** route handlers
src/components/     AppShell, sidebar, command palette, notification bell, landing components, UI primitives
lib/                Server logic: auth, inbox, communication-providers/, workflows, aiCopilot, stripe,
                    subscription, integrations, leadCapture, onboarding, notifications, email, rateLimit
src/lib/            pipelineStages, utils
prisma/             schema.prisma, migrations, seed
scripts/            db-sync, db-prepare, create-admin, check-production, final-qa, smoke-test, run-automation
public/             icons and fonts
```

## 7. Operations

- **Create an admin:** `npm run admin:create` (interactive; do not hard-code credentials).
- **Scheduled automation:** configure a scheduler (Vercel Cron or external) to call `POST /api/automation/cron` with `Authorization: Bearer $CRON_SECRET`.
- **Stripe webhooks:** point Stripe to `/api/billing/webhook` and set `STRIPE_WEBHOOK_SECRET`.
- **Verification:** `GET /api/health` must return `ready: true`; `npm run qa:smoke` against the live URL.

## 8. Current status & known gaps (summary)

| Area | Status |
| :-- | :-- |
| Core CRM (leads, pipeline, tasks, calendar, proposals, reports) | Built and working |
| Billing / trial / quotas | Built; plan-limit values need unifying |
| Automation | Built; **scheduled runs not active** until `CRON_SECRET` and a cron schedule are configured (health currently reports "degraded") |
| Unified Inbox | Partial — real account connection and email receiving still to be built |
| AI Copilot | Rule-based; no language-model backend yet |
| Security / tenant isolation | **Needs remediation before commercial launch** — see audit Tier 0 |
| Automated tests | Structural checks only; behavioural tests to be added |
| Legal pages (privacy, terms), password reset, email verification, CSV import | Not yet present |

## 9. Documentation index

Older per-phase notes (`PHASE_*.md`, `*_SETUP.md`, `*_UPDATE.md`, `FIX_NOTES.md`) describe how individual features were added and remain at the repository root for history; this document supersedes them as the system summary. Recommended: move them into a `docs/` folder.

| Document | Purpose |
| :-- | :-- |
| `PRODUCT_AUDIT_AND_RECOMMENDATIONS.md` | Bugs, gaps, inbox plan, roadmap, redesign notes |
| `DEPLOYMENT.md`, `LAUNCH_READINESS.md`, `PRODUCTION_HARDENING.md`, `FINAL_QA_CHECKLIST.md` | Deployment and go-live checklists |
| `EMAIL_SETUP.md`, `PHASE_9_STRIPE_SETUP.md`, `META_LEAD_ADS_SETUP.md`, `INTEGRATIONS_SETUP.md`, `AUTOMATION_SETUP.md`, `CALENDAR_SETUP.md` | Feature set-up guides |
