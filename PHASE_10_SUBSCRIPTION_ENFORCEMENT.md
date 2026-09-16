# Phase 10 - Subscription Enforcement & SaaS Access Control

## What changed
- Central subscription access helper in `lib/subscription.ts`.
- Trial workspaces receive a 14-day access calculation from their organization creation date.
- `active` and unexpired `trialing` workspaces can write data.
- `past_due`, `canceled`, expired trials and incomplete subscriptions are read-only for protected mutations.
- A global CRM banner communicates trial remaining time or read-only/payment state and links to `/settings/billing`.
- `/api/subscription/status` exposes the authenticated workspace's computed access state.
- Core lead, task, calendar, proposal, team/invitation, settings and outreach mutation routes were wired to the central write guard where present in this project.

## Test
1. Start normally: `npm install`, `npm run db:push`, `npm run dev`.
2. Sign in to a new workspace and verify the trial banner appears and CRM writes work.
3. In a test database, change `Organization.planStatus` to `past_due` or `canceled`.
4. Refresh the CRM: a red read-only banner should appear.
5. Attempt to create/update a lead or task: the API should return HTTP 402 with a subscription reason.
6. Open `/settings/billing`: billing remains reachable so the customer can recover payment.

## Stripe note
Stripe webhooks remain the source for changing `planStatus`. This phase consumes that status and enforces it server-side.
