# Versaly CRM — Pre-Sale Audit & Recommendations

_Audit date: 2026-11-17. Method: static review of the repository (API routes, `lib/`, Prisma schema, build scripts, key pages), `tsc --noEmit` (passes clean), and a few **read-only** requests against the live site. Nothing on production was modified. I did not call any state-changing endpoint._

**Bottom line:** the product surface is broad and the UI is impressive for a solo build, but it is **not safe to sell yet**. There are a handful of security/tenant-isolation problems that would let one customer read (or damage) another customer's data, and a public endpoint that resets the platform-admin passwords. These are all fixable, mostly in a day or two of focused work. Fix Tier 0 before any paying customer or public marketing push.

---

## 0. Tier 0 remediation status (updated 2026-11-17)

Implemented in the working tree (not yet committed/deployed; `tsc` and `qa:final` pass; not yet exercised against a live database):
**0.1** init-admin route deleted · **0.2** password seeding removed from `scripts/db-sync.js` · **0.3** `demo@versaly.com` removed from platform admins · **0.4** fallback secret removed (`lib/authSecret.ts`) · **0.5/0.6** proposals authenticated, tenant-scoped, global limit removed · **0.7** `activity`, `communications`, `search`, `calendar`, `outreach`, `email/send`, `email/templates`, `whatsapp/send` scoped (new `lib/tenant.ts`); manager notifications now per-workspace · **0.8** one hardened webhook handler (`lib/inboundWebhooks.ts`): signatures verified, tenant resolved from the connected account, no "first org" fallback · **0.9** simulate scoped and disabled in production · **0.10** channel credentials encrypted (`lib/secretBox.ts`), secrets generated with `crypto`, webhook secret shown to admins only, env-level channel credentials restricted to the Versaly workspace · **0.11** schema fixed to PostgreSQL, build-time schema rewrite and `--accept-data-loss` removed · **0.12** single plan table (`lib/plans.ts`).
Also found and fixed during the work: `POST /api/billing/change-plan` let any workspace admin switch to Enterprise **without paying** (now blocked in production).
Still open from Tier 0: a proper `prisma migrate` baseline (needs access to the production DB), and moving the rate limiter to a shared store.

---

## 1. Tier 0 — Fix before anyone else signs up (security & data isolation)

| # | Problem | Where | Why it matters | Fix |
|---|---|---|---|---|
| 0.1 | **Public endpoint resets platform-admin passwords.** `GET /api/system/init-admin` needs no auth and sets `versalylabs@gmail.com` → `labversaly-16` and `demo@versaly.com` → `password123`, role ADMIN. | `src/app/api/system/init-admin/route.ts` | Anyone who finds the URL (it is in your own docs) can reset and log in as super-admin → full access to every tenant via `/platform`. | **Delete the route.** Never ship hard-coded credentials. |
| 0.2 | **Passwords are hard-coded and re-applied on every build**, and committed to git/docs. | `scripts/db-sync.js` (`ensureDefaultAdmins`), `SYSTEM_OVERVIEW.md` | Every deploy overwrites those passwords; the real password is in git history. | Remove the seeding of fixed passwords. Create admins once via `npm run admin:create` with a prompted password. **Rotate both passwords now**; consider the old one burned (git history). |
| 0.3 | **`demo@versaly.com` is hard-wired as a platform super-admin.** | `lib/platformAdmin.ts:9` | Its password is `password123`. | Remove the default list; only trust `PLATFORM_ADMIN_EMAILS` from env. Use a separate non-privileged demo workspace. |
| 0.4 | **Hard-coded fallback auth secret** in three places. | `lib/auth.ts:56-62,158-161`, `src/middleware.ts:56-59`, `api/auth/[...nextauth]` | If `NEXTAUTH_SECRET` is ever missing/misnamed, anyone can forge a session JWT (including role ADMIN / platform admin). | Throw at startup in production if the secret is missing. No fallback. |
| 0.5 | **Proposals API has no authentication at all.** GET/POST/PATCH/DELETE work for anyone; no tenant filter. (Confirmed live: `GET /api/proposals` returns `200 []` with no login.) | `src/app/api/proposals/route.ts`, `[id]/route.ts` | Anonymous read/write/delete of every tenant's proposals; PATCH can also flip any lead to WON/LOST. | Add session + `organizationId` scoping to every query; verify `leadId` belongs to the org. |
| 0.6 | **Proposal "max 4" limit is global.** `prisma.proposal.count()` counts all tenants. | `api/proposals/route.ts:19` | Once the whole platform has 4 proposals, **nobody can create one** (and the limit makes little product sense — see §3). | Remove or scope per org / per plan. |
| 0.7 | **Cross-tenant data leaks** — these routes authenticate but never filter by `organizationId`: `activity`, `communications`, `search`, `calendar` (list + `[id]`), `outreach/[id]`, `email/send` (lead lookup), `email/templates` (+`[id]`). | see list in the file tree | A logged-in customer can see other tenants' leads, outreach history, calendar events and templates via global search / activity feed / communications, and can send email or edit/delete records of other tenants by ID. | Add a single `requireOrgSession()` helper that returns `{userId, orgId, role}` and **always** put `organizationId` in `where`. Use `findFirst({id, organizationId})` before every update/delete. Add `organizationId` to `OutreachLog`, `ActivityEvent`, `EmailTemplate` so they can be filtered directly. |
| 0.8 | **Inbound webhooks are unauthenticated and can target any tenant.** `POST /api/inbox/webhook` never verifies `X-Hub-Signature-256`; the generic payload accepts `organizationId` from the body; if no org can be resolved it **falls back to the first org in the database**; `/api/webhooks/communications/[channel]` providers return `isValid: true` for POSTs. X CRC uses fallback secret `'secret'`; GET verify accepts any token when the env var is unset. | `src/app/api/inbox/webhook/route.ts`, `lib/inbox.ts:384-397`, `lib/communication-providers/*` | Anyone can inject fake messages/leads/notifications into any customer's inbox; real messages can land in the wrong tenant. | Verify HMAC signatures with the Meta app secret; resolve the tenant from the **page / phone-number / account ID** of a connected account (never from the payload); drop the "first org" fallback; remove one of the two duplicate webhook routes. |
| 0.9 | **Simulate endpoint is cross-tenant.** It checks you are logged in but looks up the conversation by ID only. | `api/inbox/simulate/route.ts`, `lib/inbox.ts:596` | Inject messages into other tenants' conversations. Also should not exist in production. | Scope by org; hide behind a `NODE_ENV !== 'production'` / demo-workspace flag. |
| 0.10 | **Channel tokens and app secrets are stored in plaintext** (`ConnectedChannelAccount.accessToken/refreshToken/appSecret`), and `webhookSecret` is returned to the browser and generated with `Math.random()`. | `prisma/schema.prisma`, `lib/inbox.ts:711` | A DB leak = every customer's WhatsApp/Meta tokens. | Encrypt at rest (AES-256-GCM, key in env/KMS). Generate secrets with `crypto.randomBytes`. Never return secrets to the client. |
| 0.11 | **Production DB is modified on every deploy with `prisma db push --accept-data-loss`**, and the schema's datasource provider is **rewritten at build time** (`sqlite` ↔ `postgresql`). The committed `schema.prisma` says `sqlite` while prod is Postgres; the two committed migrations are SQLite-era and don't match. | `scripts/db-sync.js:84`, `scripts/db-prepare.js` | A schema change that drops/changes a column silently deletes customer data. No rollback, no history. | Move to **Postgres everywhere** (use a local Postgres/Neon branch for dev), commit `provider = "postgresql"`, use `prisma migrate dev` / `migrate deploy`, drop `--accept-data-loss`. Take a backup before the first migrate. |
| 0.12 | **Plan limits are inconsistent**, so customers will get downgraded the moment they pay. Landing page & signup: Starter 1,000 / Pro 5,000 leads; `lib/stripe.ts` (applied by the Stripe webhook): Starter **150** / Pro **500**; schema default 500. | `lib/stripe.ts:14-16`, `api/auth/register/route.ts:13-17`, `PricingSection.tsx` | A paying Growth Pro customer's limit silently drops from 5,000 to 500. | One `PLANS` constant used by signup, Stripe webhook, billing UI and landing page. |

---

## 2. Tier 1 — Serious functional bugs & gaps

**Auth & accounts**
- **No "Forgot password" / password reset flow and no email verification.** Users who forget a password are locked out (support burden on day one). Add reset-by-email tokens and verify email on signup.
- Minimum password length is 6; no breach/complexity check; no 2FA. Raise to 10+ and add TOTP for admins.
- Role/org/plan/`isActive` are baked into an 8-hour JWT and **never re-checked**. A deactivated or removed user keeps access up to 8 hours; plan changes don't show until re-login. Re-validate in `jwt` callback (cheap indexed lookup, or short `maxAge` + refresh).
- The Prisma `Session` table + `PrismaAdapter` are unused with the JWT strategy; remove to avoid confusion.
- Rate limiting (`lib/rateLimit.ts`) is **in-memory per serverless instance** → effectively no protection on Vercel. Use Upstash/Vercel KV. Also protect `/api/contact`, `/api/public/lead` with a CAPTCHA/honeypot and rate limit by IP **and** email.

**Automation & infrastructure**
- `/api/health` on production currently reports **`status: "degraded"`, `ready: false`** — `CRON_SECRET` is not set. There is **no `vercel.json`**, so no cron is scheduled; inactive-lead automations and reminders **never run**. Add a Vercel Cron entry (e.g. hourly) and set `CRON_SECRET`.
- `npm run build` runs DB sync + admin seed (§0.11); a failed DB step is swallowed (`catch → console.warn`) so a build can "succeed" against a broken DB.
- No automated tests. `npm run qa:final` ("121 checks") only asserts that files/strings exist; it does not exercise behaviour. Add a small Vitest/Playwright suite for: tenant isolation, signup→lead→pipeline, billing webhook, inbox send/receive.
- No error monitoring (Sentry), no uptime alerting, no DB backup policy documented as tested.

**Email**
- All outbound email (`/api/email/send`, inbox, welcome mails) goes through **one global SMTP account (`versalylabs@gmail.com`)** for every tenant. Customers' emails would be sent "from Versaly Labs", Gmail caps at ~500/day, and replies go to *your* mailbox, not theirs. This is the single biggest functional gap — see §4.
- Email templates are global (name is `@unique` across the whole DB) so tenant A can't have a template with the same name as tenant B, and everyone edits the same set.

**Leads & data model**
- `Lead.email` is **required**, but WhatsApp/Instagram/Facebook/TikTok contacts rarely have one. Converting an inbox conversation to a lead needs a fake email. Make email optional and enforce uniqueness only when present.
- `@@unique([organizationId, email])` does not protect rows with `organizationId = null`. The landing-page contact form and `/api/public/lead` create such rows (or attach them to the first org), so they are invisible to tenants and can duplicate.
- `/api/public/lead` has no workspace identifier — it cannot serve customer websites. Add a per-workspace public form key (`/api/public/lead?key=pk_...`) and an embeddable form snippet.
- `BusinessType` enum is real-estate-specific (residential agent, appraiser, inspector…), `Lead` has real-estate defaults, and leftover "Straten Agency/CRM" branding remains in `schema.prisma`, `LAUNCH_READINESS.md`, env example tokens (`straten_inbox_verify_token`). Decide your target vertical; if general SME/agency, make business type a free tag or custom field. Add **custom fields** — most buyers expect them.
- No lead import (CSV) / export except Reports CSV; no merge-duplicates; no bulk actions visible in the schema/routes. Business owners migrating from spreadsheets will need CSV import on day one.
- Pipeline stage is a free `String`, and the new custom-stage feature (commit `550684b`) is not honoured everywhere: `lib/inbox.ts` (hard-coded `NEW_LEAD/RESEARCHING/CONTACTED/FOLLOW_UP`), proposals (`accepted→WON`, `rejected→LOST`), dashboard `ACTIVE_STAGES`, `lib/workflows.ts` (`LEAD_INACTIVE` stage list). Renaming/deleting a stage will silently break those flows. Resolve by stage **category** (ACTIVE/WON/LOST) instead of key.
- Proposals: no PDF/shareable link, no e-sign/accept link for the client, no line items/tax, no templates beyond free text. In its current form it is a notes table with a status — weak for a feature competitors treat as core.

**Billing**
- Stripe webhook: `checkout.session.completed` sets `active` but not the plan; `customer.subscription.*` only applies a plan if the price ID matches an env var, otherwise leaves the old plan with a new status. Handle `invoice.payment_failed`, trial-ending notices, and dunning emails.
- Trial expiry is computed from `createdAt` + 14 days; an expired trial makes the workspace read-only but there's no email warning sequence (day 7, day 12, expired).
- Prices are USD ($29/$79/$199) while default workspace currency is KES and the market (phones `07…`) is Kenya. Add **M-Pesa / local pricing** (Stripe in Kenya is limited — consider Paystack/Flutterwave/Pesapal or Stripe via a supported entity). This may decide whether Kenyan SMEs can pay at all.

**"AI" claims**
- `lib/aiCopilot.ts` (494 lines) contains **no LLM calls** — sentiment, win probability, churn risk, smart replies, proposals and objection handling are rule/keyword-based. Marketing says "AI Copilot". Either wire it to a real model (Claude API with per-workspace usage caps; draft replies, summarise threads, extract next steps) or rename it "Smart suggestions" to avoid a trust problem with buyers.

**UX / product**
- 22 sidebar items across 5 groups for a new SME owner is a lot. Overlapping modules: **Outreach, Email, WhatsApp, Inbox, Activity Feed** all deal with communication; **Reports, Dashboard, Customer Success, Copilot** all deal with insights. Merge into: *Home · Leads & Deals · Inbox · Calendar & Tasks · Automations · Reports · Settings*; hide Customer Success/Copilot/Platform behind plan or "advanced".
- Many pages show the empty state "zero" well (good), but there's no guided first-run (import contacts → connect inbox → add pipeline → invite team).
- No mobile app/PWA. WhatsApp-centric SMEs live on their phones — at minimum add PWA install + push notifications.
- Notification emails default to off; no digest email ("today's tasks/follow-ups").
- Accessibility: dark theme with low-contrast slate-on-navy text in places; no `prefers-reduced-motion` handling for heavy framer-motion/landing spotlights.

**Code health**
- Giant single-file pages: `inbox/page.tsx` (2,299 lines), `calendar` (1,635), `copilot` (1,217). Several API files are minified single-line blobs (`proposals`, `v1/leads`, `integrations/page.tsx`, `billing/webhook`) and are very hard to review. Run Prettier and split components.
- Mixed import styles (`../../../../lib/...` vs `@/lib/...`) and two `lib` folders (`/lib` and `/src/lib`).
- Debris at repo root: 28 phase/fix `.md` files, `test.ts`, `test-config.js`, `test-env.js`, `manual-seed.js`, `desktop.ini`. Move docs into `/docs` and delete scratch files.
- No input validation library (zod) — each route hand-validates; dates (`new Date(body.dueDate)`) can become `Invalid Date`.
- Next.js 14.2.5 has published security advisories; update to the latest 14.2.x patch (or 15) before launch. `next-auth` v4 is in maintenance; plan a move to Auth.js v5 or keep but pin.
- `Content-Security-Policy` allows `'unsafe-inline' 'unsafe-eval'`; acceptable now, tighten later.

---

## 3. Product/market recommendations (selling it)

1. **Pick a lane.** "CRM for real-estate agents" and "CRM for agencies" are different products. The clearest pitch from what exists: *"WhatsApp-first CRM and follow-up automation for small African service businesses."* Everything (default pipeline names, templates, onboarding, copy, pricing in KES) then gets sharper.
2. **Lead with 3 outcomes, not 20 modules:** (1) never lose a lead (all chats in one place + auto follow-up tasks), (2) see the pipeline at a glance, (3) get paid / send proposals. The rest is secondary.
3. **Pricing:** show KES (and USD) prices; Starter should include the inbox with at least 1 WhatsApp number; gate Copilot/automation volume on higher tiers rather than the core inbox.
4. **Trust signals before selling:** privacy policy, terms, data-processing/Kenya DPA notice, cookie banner, status page, a real support email. None exist in the repo today; a B2B buyer will ask. The landing page testimonials/metrics (`TestimonialsAndMetrics.tsx`, `AnimatedCounter`) must be real or removed — fake social proof is a legal/reputational risk.
5. **Onboarding:** 14-day trial with a sample-data toggle and a 5-step checklist (already partly there) + a 3-minute video.
6. **Migration help:** CSV import + "import from Google Sheets / HubSpot" is the #1 switching blocker.
7. **Support:** in-app Support Desk exists (good) — add a WhatsApp support number (you already list phones) and a help centre.

---

## 4. Unified Inbox — current state and how to make it real

### 4.1 What exists today (honest assessment)

| Area | Status |
|---|---|
| UI (3-pane inbox, filters, notes, assignment, lead panel, smart replies) | Built, but 2,300 lines in one file and visually dense: 6 channels, folders, status filters, sentiment/win-probability pills, "simulate reply", intel panel. |
| **Email** | Sends via a **single global SMTP account from env**. **Cannot receive** — there is no IMAP/Gmail/Outlook sync; the inbound handler only accepts a JSON POST from a third-party parser. So it's one-way. |
| **WhatsApp** | Sending code to Meta Cloud API exists (env-var token or pasted token). Webhook parsing exists but is unauthenticated and not tenant-safe (§0.8). Users must hand-create a Meta developer app, get a System User token and paste it. No templates (messages outside the 24-hour window will be rejected by Meta), no delivery/read status updates, no media. |
| **Instagram / Facebook** | Send/receive code exists but requires the customer to create a Meta app, pass **App Review** and paste Page tokens. Not realistic for a business owner. |
| **TikTok / X** | Stubs. TikTok has no general-purpose DM API; X's DM API requires a paid developer tier. Cannot work for normal customers. |
| Realtime | Polling only. No attachments, no threading, no history import, no retries/queue. |
| Demo scaffolding | "Simulate Reply" and "X of 6 Connected" labels present production-visible. |

**Root cause of the complexity:** the inbox was designed channel-by-channel (6 providers + developer-style credential forms) rather than around the owner's job: *"see who messaged me, reply, and not forget anyone."*

### 4.2 Recommended product shape — "Simple Inbox"

**Principle:** a business owner should connect an account in **two clicks, via a "Continue with Google / Connect WhatsApp" button**, never by pasting tokens or visiting a developer portal.

**Scope for v1 (sellable):**
1. **Email** (Gmail / Google Workspace, Outlook/Microsoft 365, plus generic IMAP/SMTP) — send *and* receive, threaded.
2. **WhatsApp Business** via Embedded Signup — send and receive, templates, delivery ticks.
3. **Website enquiries & lead forms** (already built) appear in the same list as "Form" messages.
4. Everything else — **Instagram, Facebook Messenger → "Coming soon"** (phase 2 via the same Meta onboarding); **TikTok and X → remove from the UI** until a viable API exists. Don't show disconnected channels as 4 dead rows; show only what's available.

**Simplified UI (replace the 3-column power-user layout):**
- Two panes: **conversation list** | **thread**. The lead/CRM details open in a slide-over (button "Contact details"), not a permanent third column. On mobile: list → thread.
- Filters reduce to a segmented control: **Mine · Unassigned · All**, plus a single **Open / Done** toggle. Move channel filters into a small dropdown. Drop status names like `WAITING_ON_US/WAITING_ON_CUSTOMER/PENDING`; map them to Open/Done (+ "Snoozed").
- Composer: one box, channel auto-selected from the thread ("Replying via WhatsApp"), a "Private note" tab, quick replies, attachments. No manual channel switching on existing threads.
- First-run empty state: a **"Connect your inbox" wizard** with big Gmail / Outlook / WhatsApp cards and a progress checklist. Hide the "Simulate reply" button outside a demo workspace.
- Unknown sender → one-click **"Add as lead"** (pre-filled).
- Remove sentiment/win-probability pills from the list; show them only in the contact panel.

### 4.3 How to actually connect real accounts (technical plan)

**A. Email — recommended path (fastest to production):**
- **Option 1 (build it yourself):**
  - *Gmail:* Google OAuth (scopes `gmail.send`, `gmail.readonly` or `gmail.modify`) + Gmail API `users.watch` with Pub/Sub push to a webhook, history sync for new mail. **Caveat:** Gmail read scopes are "restricted"; to serve the public you must pass Google OAuth verification and a CASA security assessment (weeks + cost). Plan for it.
  - *Outlook/M365:* Microsoft Graph OAuth + change-notification subscriptions (needs Azure app registration; verification is simpler than Google).
  - *Any other mailbox:* IMAP IDLE/poll + SMTP with an **app password** (works day one, no review). Good as the launch fallback.
- **Option 2 (buy it, recommended for a solo founder): an email-API aggregator** such as Nylas, Unipile or EmailEngine. They handle Gmail/Outlook/IMAP OAuth, threading and webhooks behind one API; you pay per connected account. This removes the CASA burden from your launch path.
- **Zero-integration fallback (ship in a day):** give every workspace a **forwarding/BCC address** (`acme@inbox.versalylabs.com`) via Postmark/Resend/SendGrid inbound parse. Customers BCC or auto-forward and replies thread back. Combine with per-workspace **verified sending domain** (Resend/Postmark/SES, SPF/DKIM) for outbound, instead of the shared Gmail SMTP.
- Threading: store `Message-ID`, `In-Reply-To`, `References`; set them on replies; one `Conversation` per thread, not one per lead (today `getOrCreateConversation` returns *the* conversation for a lead regardless of channel/subject).
- Sanitize inbound HTML (DOMPurify/sanitize-html), strip quoted replies, support attachments (store in S3/R2/Vercel Blob, not in the DB).

**B. WhatsApp:**
- Register as a **Meta Tech Provider** and use **Embedded Signup**: customer clicks "Connect WhatsApp", logs into Facebook, selects/creates their WhatsApp Business Account and number; you receive a token + `phone_number_id` automatically. Requires Meta Business Verification of *Versaly Labs* (one-time) and the app to be approved for `whatsapp_business_messaging` / `whatsapp_business_management`.
- **Faster alternative:** a Business Solution Provider that wraps this — **Twilio**, **360dialog**, **Gupshup**, or **Africa's Talking** (strong in Kenya) — so customers connect through a hosted flow and you integrate one stable API.
- Must implement: **message templates** (needed for first contact / after 24 h), the **24-hour customer-service window** logic in the composer ("Window closed — send a template"), **status webhooks** (sent/delivered/read/failed → update `deliveryStatus`), inbound **media**, opt-in tracking.
- Webhook routing by `metadata.phone_number_id` → `ConnectedChannelAccount.externalAccountId` → organization. This replaces the unsafe "first org" fallback.
- Consider supporting the **WhatsApp Business app "coexistence"** mode so owners can keep using their phone app alongside the CRM.

**C. Instagram & Facebook (phase 2):** same Meta OAuth ("Continue with Facebook") → select Page → auto-subscribe webhook. Requires App Review for `instagram_manage_messages` / `pages_messaging`, plus the 24-hour messaging window rules. Reuse the same infrastructure as WhatsApp.

**D. Platform hardening that all channels need:**
- One webhook entry point per provider; verify signatures; idempotency key `(organizationId, externalMessageId)` (current dedupe is global by `externalMessageId`).
- Background queue for sends and webhook processing (Upstash QStash / Inngest / Vercel Queues) with retries and a visible "Failed — retry" state, instead of doing work inside the request.
- Encrypted credentials; token refresh job; "Reconnect" banner when a token expires (`ConnectedChannelAccount.status = ERROR` already exists in the schema).
- Realtime: replace 15-second polling with SSE or a hosted realtime service (Pusher/Ably) so replies appear instantly; add browser/PWA push notifications for new messages.
- Usage guards: per-plan limits on connected accounts and message volume.
- Delete or isolate the duplicate webhook implementations (`/api/inbox/webhook` and `/api/webhooks/communications/[channel]`) into one.

### 4.4 Suggested delivery order for the inbox

1. **Week 1:** Fix §0.8–0.10 (webhook auth/tenant routing, simulate, encryption). Hide TikTok/X/IG/FB. Add per-workspace inbound email address + verified sending domain. UI simplification (2 panes, Mine/Unassigned/All, Open/Done).
2. **Week 2–3:** Email connect — IMAP/SMTP app-password flow, then Gmail/Outlook OAuth (or Nylas). Threading + attachments + "Add as lead".
3. **Week 3–5:** WhatsApp via Embedded Signup or a BSP: templates, 24h window, status webhooks, media.
4. **Later:** Instagram/Facebook, canned replies library per workspace, SLA timers, round-robin assignment, AI draft replies (real LLM).

---

## 5. Recommended roadmap

| Phase | Goal | Contents |
|---|---|---|
| **A — Safety (do now, ~2–3 days)** | No data leaks, no known credentials | §0.1–0.12; add `requireOrgSession` helper; rotate admin passwords; enforce `NEXTAUTH_SECRET`; proper Prisma migrations + backup; Vercel cron + `CRON_SECRET`; Sentry. |
| **B — Core completeness (1–2 weeks)** | Something a stranger can use unaided | Forgot-password, email verification, CSV import, per-workspace email sending, single `PLANS` source, trial/billing emails, proposal share link/PDF, tenant-isolation tests. |
| **C — Inbox v1 (2–4 weeks)** | Real communication | §4 (email + WhatsApp), simplified UI. |
| **D — Redesign (planned next)** | Premium brand feel | New colour system, typography, landing page, simplified navigation (see §6). |
| **E — Growth** | Scale | Real AI features, mobile PWA, local payments (M-Pesa), marketplace/integrations (Google Calendar two-way sync, Zapier/Make already partly covered by webhooks + API). |

## 6. Notes for the upcoming redesign (so we don't do work twice)

- Do the **navigation consolidation** (22 → ~7 top-level items) *as part of* the redesign, not after.
- The visual language today is a navy/cyan "liquid glass" (heavy blur, glows, spotlight cursors). For a premium, trustworthy B2B feel, common directions are: restrained neutral base + one signature accent (e.g. deep ink + warm gold/emerald), high-contrast type, fewer glows, generous whitespace. Heavy blur/glass also costs performance on low-end phones.
- Extract design tokens (colours, radii, shadows, spacing, typography) into Tailwind theme + CSS variables first; today many pages hard-code classes like `dark:bg-[#1b2a4a]/80`, which makes a re-colour a search-and-replace across ~30 files.
- Keep the Glorase display font for hero headings only; keep Inter for UI (already the direction of the latest commit).

## 7. Things that are already good (keep)

- Clean zero-states for new accounts, subscription gating (`assertSubscriptionWriteAccess`), webhook idempotency for Stripe, HMAC-signed outbound webhooks and API keys (hashed), invite tokens signed with HMAC, security headers/CSP, request IDs, role-aware calendar visibility, workflow execution keys for idempotency, custom pipeline stages, multi-currency formatting, platform admin console + audit log, health endpoint.
- TypeScript compiles with zero errors.

---

### Immediate action checklist (copy/paste)
- [ ] Delete `src/app/api/system/init-admin/route.ts`
- [ ] Remove password seeding from `scripts/db-sync.js`; rotate `versalylabs@gmail.com` & `demo@versaly.com` passwords; remove `demo@versaly.com` from `lib/platformAdmin.ts`
- [ ] Remove plaintext password from `SYSTEM_OVERVIEW.md` (done in the updated doc) and treat the old one as leaked
- [ ] Remove fallback auth secret in 3 places; confirm `NEXTAUTH_SECRET` is set in Vercel
- [ ] Authenticate + tenant-scope `proposals`, `activity`, `communications`, `search`, `calendar`, `outreach/[id]`, `email/*`
- [ ] Verify webhook signatures; remove "first org" fallback; secure/remove `simulate`
- [ ] Encrypt channel credentials
- [ ] Switch to Postgres + `prisma migrate`; remove `--accept-data-loss`
- [ ] Unify plan limits; set `CRON_SECRET` + add `vercel.json` cron
- [ ] Add password reset + email verification
