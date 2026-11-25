# VersalyLabs CRM: phased development plan

_Created 24 Nov 2026. It is based on [AUDIT_2026-11-24.md](./AUDIT_2026-11-24.md). Section references such as §2.1 point to that report._

## How we work through it

- **One phase at a time.** At the end of each phase I run the app on a local server (http://localhost:3002) and give you a short checklist of things to click through. Nothing is pushed until you approve it.
- **Commits:** at least one per phase, with a clear message. Pushing to `main` deploys to production on Vercel.
- **Database changes:** every phase that changes the database schema adds a reviewed, non-destructive migration. Before any such change reaches production, we take a backup.
- **Checks:** every phase ends with the TypeScript check, a build, and tests for any new logic that handles money, security or tenant data.
- **Recommending the next phase:** after each phase I recommend what to do next. That may change the order below if something more urgent shows up.

**Size key:** S is 1–2 working sessions, M is 3–5, L is 6 or more. These are rough estimates for building with me, and do not include your review time or waiting on outside approvals.

---

## Start these now (your actions, they have long lead times)

These are outside approvals that later phases depend on. Some take weeks, so it's best to start them in parallel with Phases 1–5.

| # | Action | Needed by | Typical lead time |
|---|---|---|---|
| A1 | **Send me the new brand assets:** logo (SVG), icon-only mark, colour codes (primary, accent, neutrals), font preferences | Phase 2 | — |
| A2 | **Confirm the legal entity name** for the footer, terms and invoices (today the site says "Versaly Technologies Inc.") | Phases 1–2 | — |
| A3 | **Open a Paystack Kenya business account** with M-Pesa and cards enabled | Phase 4 | 1–2 weeks (KYC) |
| A4 | **Register with the ODPC** (Data Protection Commissioner) as a data processor | Before paid launch | 2–4 weeks |
| A5 | **Safaricom Daraja:** create an account and apply for production go-live (STK Push + C2B) | Phase 6 | 2–6 weeks |
| A6 | **Meta Business Verification** for VersalyLabs, then apply to be a **WhatsApp Tech Provider** | Phase 7 | 2–8 weeks |
| A7 | **Africa's Talking account** with a Sender ID application | Phase 7 | 1–3 weeks |
| A8 | **KRA eTIMS:** find out about third-party integrator (OSCU) requirements, or choose an approved partner | Phase 8 | Varies |
| A9 | **Anthropic API key** for the AI assistant, with a monthly spend cap | Phase 9 | Same day |
| A10 | **Optional: custom domain** such as `app.versalylabs.com` | Phase 2 | Same day |

## Decisions I need from you (I've assumed the defaults below until you say otherwise)

| Decision | Default I'll use |
|---|---|
| Tier structure and prices | Solo 1,200 · Starter 3,200 · Growth Pro 9,900 · Enterprise 29,900 KES per month, billed annually. Monthly billing costs about 20% more. Features per tier follow audit §4. |
| Payment provider for your own subscriptions | Paystack. Stripe stays only if you have a non-Kenyan entity. |
| Trial | 14 days on Growth Pro, no card required |
| Primary market positioning | "The CRM that gets Kenyan businesses paid": WhatsApp + M-Pesa + eTIMS |
| AI model | Claude via the Anthropic API, using the latest Sonnet model, with per-workspace credit caps |
| Swahili | UI translation in Phase 9; templates available earlier |

---

## Phase 0: Security hotfix ✅ DONE (deployed 24 Nov 2026)

Closed four live holes:
- platform-admin escalation;
- the fallback secret for invite links;
- tenants sending email and WhatsApp through the platform's own accounts;
- WhatsApp/Facebook account hijacking between workspaces.

Also fixed the invite email check (commit `18671c1`).

**Still to do (you):**
- Check the `/platform` audit log for access you don't recognise.
- Confirm `PLATFORM_ORG_SLUG` matches your workspace.

---

## Phase 1: Trust and honesty (S)

**Goal:** nothing on the site or in the app claims something that isn't true. This is the cheapest risk reduction there is.

**Billing page and in-app copy:**
- Remove the fake "VISA •••• 4242" card, the fake "Paid" invoice `INV-2026-009`, and the `alert()` buttons. Replace them with honest empty states ("No invoices yet").
- Make the billing page read its limits and prices from `lib/plans.ts`, so 150/500 leads and $29/$79/$199 disappear.
- Fix the dashboard upgrade modal ("$199/month", button that only shows an alert): link it to the billing page instead.

**Landing page:**
- Remove the invented metrics and testimonials. Replace them with a "Built for Kenyan businesses" section, or with real early-access quotes later.
- Fix the hero KPIs that show "0".
- Replace `demo@versaly.com` in the hero.
- Pricing cards list only features that exist today. Features that are coming are labelled **"Coming soon"** rather than "included".
- FAQ: remove the CSV-import promise until Phase 5.
- Footer:
  - correct the legal entity name;
  - "Kenya Data Protection Act" instead of "GDPR";
  - remove "End-to-End Encryption";
  - remove "99.9% uptime" until we have monitoring;
  - turn plain-text items into real links or remove them.

**New pages:**
- Privacy Policy and Terms of Service at `/privacy` and `/terms`, written for the Kenya DPA. These must be public, so the middleware needs updating. Signup links to them.
- A custom 404 page (`not-found.tsx`) and an error page (`error.tsx`).
- Add the missing `favicon.ico`.

**Onboarding:** stop seeding tasks that refer to sample data that doesn't exist.

**Done when:** every claim on the site maps to a working feature or says "Coming soon", and the legal pages load while signed out.

**Preview checklist for you:**
- landing page top to bottom;
- `/privacy` and `/terms`;
- the billing page;
- an unknown URL, to see the 404 page.

---

## Phase 2: Rebrand to VersalyLabs (M) — needs A1, A2

**Goal:** new name, logo and colours everywhere. The colour system must become token-based, so any future re-colour is a one-file change.

**1. Design tokens first:**
- Define the brand colours as CSS variables in `globals.css`, mapped into the Tailwind theme with semantic names (`brand`, `accent`, `surface`, `surface-raised`, `ink`, `muted`, `border`, `success`, `warning`, `danger`).
- Remove the unused `versaly-*` tokens.
- Remove the trick that makes the `sky`/`cyan` palettes render gold.
- Remove the `!important` colour overrides.

**2. Replace hard-coded colours:** the ~470 hard-coded hex colour classes (`bg-[#1b2a4a]` and similar) across ~30 files become token classes. Work file by file, worst first: calendar, copilot, hero, dashboard charts, tasks.

**3. Logo and icons:**
- Rename `VersalyLogoIcon.tsx` to `VersalyLabsLogo.tsx`, with full and mark variants.
- Replace `icon.svg`, `apple-icon.svg` and `favicon.svg`, and add a real `favicon.ico`.
- Add an Open Graph image for link previews (shown on WhatsApp shares).

**4. Name:**
- Change about 80 "Versaly"/"Versaly CRM" strings to "VersalyLabs" / "VersalyLabs CRM". This covers metadata, email templates, onboarding copy, the calendar ICS PRODID and the platform console.
- Change the API key prefix `str_live_` to `vl_live_`. Existing keys keep working.
- Remove the leftover "Straten" comments.
- Remove the real-estate-only enum values from the UI.

**5. Typography:**
- Keep the Glorase display font for hero headings only (or the new brand font).
- Use Inter for the interface.

**6. While touching every page:**
- Fix the 11 invalid Tailwind classes.
- Add visible focus rings in place of the removed outlines.
- Raise text that is under 11 px.

**Optional:** move to a custom domain (A10).

**Done when:** a search for `Versaly"` / `Versaly CRM` and a search for `[#` hex classes in `src/` both return nothing outside the brand token file, and the app looks right in the new palette on desktop and mobile.

**Preview checklist for you:** landing page, sign-in, dashboard, pipeline, inbox, calendar, settings, and a phone-width view.

---

## Phase 3: Core hardening (M)

**Goal:** safe to sell. It fixes the remaining backend items from audit §2.1–2.2.

**Subscription enforcement:**
- One shared `requireWritableOrg()` guard used by **every** route that changes data: leads, tasks, calendar, outreach, inbox, email, WhatsApp, settings, admin, the v1 API and public capture.
- Automations also stop when the subscription is inactive.
- The result: once the trial or subscription ends, the workspace really becomes read-only.

**Plan limits:**
- Check the lead limit on every create path: API, public form, Meta Lead Ads, inbox "Add as lead", CSV import.
- Make the seat check atomic, so two invites at once can't both exceed the limit.

**Tenant leaks:**
- Leads with no workspace must no longer be readable from any workspace.
- Check that the `leadId` and assignee on tasks, leads and workflows belong to the same workspace.
- Make `notifications/alerts` count only the current workspace.
- Routes must not fall back to unfiltered queries when a user has no workspace.

**Public lead capture:** add a per-workspace public form key. Capture must then require a workspace and must never assign leads across workspaces.

**Auth:**
- Re-check the user's role, plan and active status from the database on each session refresh, so a deactivated user loses access straight away.
- Raise the minimum password length to 10.
- Add password reset by email.
- Add email verification.
- Remove the unused `PrismaAdapter`.
- Move rate limiting to Upstash Redis (free tier), and add it to `/api/contact`, `/api/v1/leads` and auth.

**Roles:** only admins and managers can edit pipeline stages.

**Data integrity:**
- Deleting a lead or user no longer fails with a 500 error (add cascades or soft-delete).
- Invalid dates return a 400 error instead of a 500.
- Search becomes case-insensitive.
- Lead **email becomes optional** (WhatsApp contacts), with uniqueness enforced only when an email is present.
- Add an `organizationId` column to `OutreachLog` and `ActivityEvent`.
- Add the missing indexes.

**Inbox reliability:**
- Fix the email-sync bug that skips messages when more than 40 arrive.
- The cron skips mailboxes in an error state.
- Fix the N+1 inactive-lead job.
- Deliver webhooks asynchronously, with SSRF guards (block private IPs, https only).

**Custom stages:** honour them everywhere by resolving stage *category* (Active/Won/Lost) instead of hard-coded names. This covers workflows, proposals, inbox, email send and the dashboard.

**Billing webhook correctness:** set the plan on checkout, handle failed payments, and fix the idempotency race. This moves to Paystack in Phase 4.

**Database migrations:** replace `db push` with a proper `prisma migrate` baseline, taken from production with a backup first. Delete the old SQLite-era migrations.

**Tests:**
- Add Vitest with a test database (a Neon branch).
- Tenant-isolation tests for every route that takes an ID, plus tests for subscription read-only mode and plan limits.

**Monitoring:** Sentry (free tier) for errors.

**Done when:** the test suite proves that workspace A cannot read or change workspace B's data on any route, that an expired workspace cannot write, and that limits hold on every create path.

**Preview checklist for you:**
- forgot password;
- sign up and verify email;
- invite a teammate;
- delete a lead;
- an expired-trial workspace is read-only.

---

## Phase 4: Plan gating and billing (M) — needs A3

**Goal:** tiers unlock different features, and you can get paid in Kenya.

**Feature entitlements:**
- Create `lib/entitlements.ts`, with one table of feature × plan built from audit §4.
- Add `can(org, 'whatsapp_inbox')` checks on both server and UI.
- Locked features show a clear "Upgrade to Growth Pro" card instead of failing.

**Tiers:** add the **Solo** tier and update all limits in `lib/plans.ts`. Grandfather any existing customers at their current price.

**Paystack billing:**
- Card subscriptions that renew automatically.
- One-off M-Pesa payments for monthly or annual terms.
- Webhook with signature check and idempotency.
- Real annual billing.

**M-Pesa renewal flow:** WhatsApp/SMS/email reminders 7 days, 3 days and 1 day before expiry, with a pay-now link.

**Invoices and receipts:** real numbered invoices, downloadable as PDF and emailed, in KES, with your entity details. Workspaces can add their KRA PIN.

**Trial lifecycle:** emails on day 1, day 7, day 12, at expiry, and 3 days after expiry. Plus an in-app countdown banner.

**Billing page rebuilt:** current plan, usage meters (leads, seats, automation runs, AI credits), invoices, change plan, and cancel.

**Plan comparison:** both the landing page and the billing page generate their feature lists from the same entitlements table, so marketing can never drift from the code again.

**Done when:**
- a test workspace pays by M-Pesa and by card (Paystack test mode) and lands on the right plan;
- locked features show upgrade cards;
- receipts arrive.

**Preview checklist for you:** pricing page, upgrade flow in Paystack test mode, billing page, and a locked feature on Starter.

---

## Phase 5: Onboarding, data and navigation (M)

**Goal:** a stranger can sign up and get value in 10 minutes, unaided.

**Signup:** add a phone number (Kenyan format, +254) and an industry choice.

**Onboarding wizard:**
1. Choose an industry template (sets up pipeline stages and fields).
2. Import contacts.
3. Connect email or WhatsApp.
4. Invite the team.
5. Create the first deal.

The wizard also offers an optional **sample-data workspace** toggle.

**CSV/Excel import:**
- Column mapping, duplicate detection and a preview.
- An error report for rows that fail.
- Google Sheets export works as CSV.

**Export:** all leads and deals to CSV. This also supports Data Protection Act requests.

**Custom fields:**
- Types: text, number, date, dropdown, checkbox, phone.
- They appear on lead forms, filters, import and the API.
- Limited per tier.

**Industry templates:**
- Real estate (rent, off-plan)
- Schools (fees)
- SACCO/chama
- Solar/PAYG
- Insurance renewals
- Car dealers
- General B2B services

**Embeddable lead form:** a snippet that uses the per-workspace key from Phase 3, plus a **click-to-WhatsApp link** generator.

**Navigation:** cut 19 items to about 8:
- Home
- Leads & Deals (list + pipeline)
- Inbox (includes the old Outreach, Email and WhatsApp pages)
- Calendar & Tasks
- Payments (Phase 6)
- Automations
- Reports
- Settings (Team, Integrations, Billing, Pipeline, Developer)

Customer Success, Copilot and the Activity feed move into contact pages or Reports.

**Lead bulk actions:** assign, change stage, tag, delete.

**Help centre:** a public `/help` section with short how-to guides and a "Chat with us on WhatsApp" support button.

**Done when:** a new account goes from signup to imported contacts and a moving pipeline without help.

**Preview checklist for you:** full signup, the wizard, importing a sample CSV, custom fields, and the new navigation on a phone.

---

## Phase 6: M-Pesa for customers (L) — needs A5 (sandbox works before approval) ✅ BUILT (25 Nov 2026, awaiting your review)

**What shipped:** connect a Paybill/Till with Daraja keys (checked with Safaricom, encrypted); STK prompts and public pay links (`/pay/<token>`) from a customer's Payments tab, with live status; C2B auto-matching by account number, then phone, then a unique open amount, with an Unmatched queue; Payments page (overview, transactions + CSV export, unmatched, instalments, settings); instalment plans with oldest-first allocation, reminders by email/WhatsApp (3 days before, on the day, 1 and 7 days late) from the daily cron, and debtor ageing; automation triggers `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PLAN_COMPLETED`; plan limits in `lib/plans.ts`. Production schema change: `prisma/manual/2026-11-25-phase6-mpesa.sql` (additive only), run before deploying.

**Not done in this phase:** reminders by SMS (Phase 7), payments from invoices (Phase 8), M-Pesa Ratiba standing orders (needs Safaricom approval).

**Goal:** the headline differentiator. Customers get paid on M-Pesa from inside the CRM, and payments match themselves to the right customer.

**Workspace setup:** connect a Paybill or Till with Daraja credentials, which are encrypted. A guided setup with a sandbox test comes first.

**STK Push requests:**
- From a lead, deal or invoice, send "Pay KES X" to the customer's phone.
- The payment status updates live and is logged on the timeline.

**C2B auto-reconciliation:**
- Payments received by Paybill or Till are matched automatically to a contact or invoice. Matching uses the account reference, then the phone number, then the amount.
- Anything unmatched goes to an "Unmatched payments" queue for one-click assignment.

**Payments module:**
- Transactions list.
- Collections dashboard: today, this month, outstanding.
- Export for the accountant.

**Installment plans:**
- Payment schedules on a deal (deposit plus N instalments).
- Automatic reminders by WhatsApp, SMS or email before and after each due date.
- Debtor ageing report (current, 30, 60, 90+ days).

**Automation triggers:** add "payment received", "payment overdue" and "plan completed".

**Entitlements:**
- Solo: limited STK Push.
- Starter: reconciliation on 1 shortcode.
- Growth Pro: 3 shortcodes plus instalments.
- Enterprise: unlimited, plus M-Pesa Ratiba standing orders, which come later once Safaricom approves.

**Done when:** in the Daraja sandbox, an STK payment and a C2B payment each land on the right contact, and an overdue instalment sends a reminder.

**Preview checklist for you:** connect the sandbox shortcode, request a payment, see it reconcile, create an instalment plan.

---

## Phase 7: WhatsApp Business API and SMS (L) — needs A6, A7 ✅ BUILT (25 Nov 2026, awaiting your review)

**What shipped:** WhatsApp delivery ticks (sent/delivered/read/failed, never moving backwards), inbound photos/documents/voice notes (fetched from Meta on demand, no file storage), the 24-hour window enforced on the server with an approved-template picker in the composer, template list + submission for Meta review (Settings → Messaging & SMS), Embedded Signup code ready behind `META_APP_ID`/`META_APP_SECRET`/`META_ES_CONFIG_ID` (manual connection stays until Meta approves you), round-robin assignment, reply-time target with escalation (notification + `CONVERSATION_ESCALATED` automation), monthly WhatsApp usage with a KES cost estimate, Africa's Talking SMS from prepaid credits bought via Paystack (packs in `lib/sms.ts`), bulk SMS from Leads, SMS replies in the inbox, SMS as the last fallback for payment reminders, Enterprise sender name, faster inbox refresh (8 s) and desktop alerts. Production schema change: `prisma/manual/2026-11-25-phase7-messaging.sql` (additive only).

**Not done in this phase:** server-sent events (8-second polling instead), media storage in Blob/R2 (media is streamed from Meta while Meta keeps it, about 30 days), inbound SMS (sender IDs are one-way), SMS delivery reports.

**Goal:** a real team WhatsApp inbox that customers connect in two clicks, with SMS as a fallback.

**WhatsApp connection:**
- **Embedded Signup:** "Connect WhatsApp" opens Meta's flow, and the token and phone number ID arrive automatically. Meta bills each customer directly for messages.
- Until Tech Provider approval comes through, we offer the manual connection that exists now, now verified (Phase 0).

**Messaging rules:**
- **Templates:** create, submit and sync approval status. The composer enforces the **24-hour window**: once it closes, the user must send an approved template.
- **Delivery ticks:** sent, delivered, read and failed, from status webhooks. Inbound **media** (images, documents, voice notes) is stored in Vercel Blob or R2.

**Team inbox:** round-robin assignment, SLA timers ("reply within 15 minutes"), and an escalation automation. This makes the "Automated SLA & escalation" claim real.

**Cost meter:** messages sent by category, with a KES estimate against Meta's free 1,000 service replies per month.

**Africa's Talking SMS:**
- Prepaid SMS credits (a margin opportunity), custom Sender ID on Enterprise.
- SMS is the fallback for reminders when WhatsApp fails.

**Live updates:** new messages appear in real time (server-sent events), with browser push notifications.

**Done when:** a test number connects through Embedded Signup, sends and receives text and media, the 24-hour window is enforced, and SMS sends from credits.

**Preview checklist for you:** connect a WhatsApp number, have a conversation, send a template, buy SMS credits, send an SMS.

---

## Phase 8: Quotes, proposals and eTIMS invoicing (M–L) — needs A8 ✅ BUILT (25 Nov 2026, awaiting your review)

**What shipped:** quotes with line items, discounts and per-line VAT (16%, 8%, zero-rated, exempt, no VAT), numbered Q-0001; a client link (`/q/<token>`) to view, print/PDF and accept with name + timestamp or decline (moves the deal stage and notifies the team); quote → invoice; standalone invoices (INV-0001) with due dates, a customer link (`/i/<token>`) to view, print/PDF and pay by M-Pesa; payments (pay links, STK, Paybill with the invoice number as account) mark invoices part-paid/paid; overdue is derived; credit notes (CN-0001) and void; KRA eTIMS via OSCU (device initialisation, item registration, sale transmission, CU number/signature/QR on the document); Settings → Invoicing for business details, KRA PIN and eTIMS. Production schema change: `prisma/manual/2026-11-25-phase8-invoicing.sql` (additive only).

**Not verified:** the eTIMS calls are built to KRA's OSCU spec but untested until you have KRA sandbox credentials (A8). The old client-side 4-proposal limit is gone.

**Goal:** go from a quote to a paid, KRA-compliant invoice without leaving the CRM.

**Quotes and proposals:**
- Line items, quantities, discounts, VAT 16% or exempt.
- Templates, branded PDFs, a share link, and a client **"Accept"** button with a name and date stamp.
- Remove the old 5-proposal cap.

**Invoices:**
- Convert an accepted quote to an invoice.
- The invoice includes an M-Pesa pay link (Phase 6).
- Status (draft, sent, part-paid, paid, overdue), updated automatically by reconciliation.

**KRA eTIMS:**
- Transmit invoices through OSCU or an approved partner.
- Store the control unit invoice number and QR code on the PDF.
- Credit notes.

**Entitlements:** quotes on all tiers (limited on Solo); invoices and eTIMS on Growth Pro and above.

**Done when:** quote → accept → invoice → M-Pesa payment → marked paid works end to end, and the invoice passes eTIMS in the sandbox.

**Preview checklist for you:** build a quote, accept it as the client, convert it, pay it, download the eTIMS PDF.

---

## Phase 9: Real AI, field sales and mobile (L) — needs A9

**Goal:** the premium value that justifies Growth Pro and Enterprise.

**AI assistant (Claude API):**
- Draft WhatsApp and email replies in context.
- Summarise long threads and calls.
- Next-best-action for each deal.
- Churn and payment-risk scoring, using the M-Pesa payment history.
- Describe an automation in plain words and get a draft rule.
- Credits are metered per workspace with plan caps. This replaces the rule-based `lib/aiCopilot.ts` and makes the "AI" claims true.

**Field sales:** GPS check-in and check-out on visits, visit notes with photos, today's route list, and a manager map view.

**PWA:**
- Installable app on Android.
- Offline queue for field reps (notes and check-ins sync when back online).
- Push notifications.
- Low-data mode.

**Swahili:** UI translation (English/Kiswahili switch), plus Swahili message templates.

**Team performance:** targets, a leaderboard, and a collections-versus-target report.

**Done when:**
- AI drafts and summaries work within credit caps;
- a rep checks in offline and it syncs later;
- the app installs on an Android phone;
- the Swahili toggle covers the main screens.

---

## Phase 10: Enterprise tier (M)

**Goal:** the top tier clearly earns its price.

**Branches:** multiple branches/teams, data visibility per branch, and multiple WhatsApp numbers and shortcodes.

**Custom roles:** permissions chosen per module (view, edit, delete, export).

**Tenant audit log:** who did what and when, searchable, with CSV export ("Export audit trails" becomes real).

**Data Protection Act kit:** consent capture on forms, opt-out handling, access/delete requests for a contact, and data retention rules.

**Developer platform:**
- Full REST API (leads, deals, contacts, payments, invoices).
- Webhooks for all events.
- API docs page.
- Zapier/Make-compatible.

**White-label client portal:** customers view quotes, invoices and payment history on the workspace's own domain.

**Scheduled reports:** emailed weekly or monthly to managers.

**Ops for selling Enterprise:**
- Public status page with uptime monitoring, before any SLA claim goes back on the site.
- Onboarding package and setup fee.

---

## Later and ongoing (not scheduled yet)

- Instagram and Facebook Messenger in the inbox (same Meta setup as Phase 7).
- Gmail and Outlook one-click sign-in for email, replacing app passwords (requires Google's security review).
- Google Calendar two-way sync.
- Native mobile apps, if the PWA isn't enough.
- Referral and partner programme.
- Housekeeping: move the 30+ phase notes into `docs/archive/`, split the giant page files as they're touched, and remove the minified one-line files.

## Suggested order and rough timeline

```
Phase 1  Trust & honesty        █
Phase 2  Rebrand                ██          (needs A1/A2)
Phase 3  Core hardening         ███
Phase 4  Gating & billing       ███         (needs A3)
Phase 5  Onboarding & data      ███
Phase 6  M-Pesa                 █████       (needs A5)
Phase 7  WhatsApp + SMS         █████       (needs A6/A7)
Phase 8  Quotes & eTIMS         ████        (needs A8)
Phase 9  AI, field, PWA         █████       (needs A9)
Phase 10 Enterprise             ███
```

**Earliest sensible paid launch:** after Phase 5. At that point the product is safe, honest, rebranded, billable in KES and self-serve. You can sell Starter and Growth Pro, with M-Pesa, WhatsApp API and eTIMS shown as "Coming soon". Each later phase is then a release you can announce.
