# Phase 9 - Stripe Subscription Lifecycle

## What changed
- Added Stripe customer/subscription fields to `Organization`.
- Plan buttons now start secure Stripe Checkout instead of mutating plans directly.
- Added Stripe Billing Portal endpoint.
- Added verified webhook endpoint that updates subscription status, plan and quotas.

## Install and migrate
```powershell
npm install
npm run db:push
npm run dev
```

## Configure Stripe
Copy `.env.example` to `.env` if needed. Add a Stripe secret key and create recurring monthly/annual prices for each plan. Put the resulting `price_...` IDs in the matching variables.

Configure a webhook to:
`http://localhost:3000/api/billing/webhook`

For local testing with Stripe CLI, forward events to that endpoint and copy the CLI webhook secret into `STRIPE_WEBHOOK_SECRET`.

Recommended events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

## Test
1. Sign in as a workspace ADMIN.
2. Open `/settings/billing`.
3. Choose a different tier.
4. Complete Stripe test checkout.
5. Confirm webhook delivery succeeds.
6. Refresh billing and verify plan/status/quotas changed.
7. Click `Manage billing in Stripe` to test the Billing Portal.

## Security note
The old direct `change-plan` endpoint remains in the source for backward compatibility but should not be exposed as a production plan-changing mechanism. The UI now uses Stripe Checkout; remove or hard-disable that endpoint before public launch if no internal migration workflow needs it.
