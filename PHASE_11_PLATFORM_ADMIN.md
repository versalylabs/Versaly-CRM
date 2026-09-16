# Phase 11 — SaaS Platform Admin Console & Business Analytics

## Added
- `/platform` platform-owner dashboard.
- Server-side platform authorization through `PLATFORM_ADMIN_EMAILS`.
- `GET /api/platform/overview` with organization-wide metrics.
- Total organizations, active subscriptions, trials, past-due, canceled, estimated MRR/ARR, trial rate, cancellation rate.
- Searchable tenant/workspace table with plan, status, user usage, lead usage, and creation date.

## Configure
Add your platform owner email to `.env`:

```env
PLATFORM_ADMIN_EMAILS="you@example.com"
```

Multiple admins:

```env
PLATFORM_ADMIN_EMAILS="owner@example.com,admin@example.com"
```

The value is checked server-side. Ordinary tenant administrators cannot access `/api/platform/overview`.

## Run
```powershell
npm install
npm run db:push
npm run dev
```

Then sign in with an email listed in `PLATFORM_ADMIN_EMAILS` and open `http://localhost:3000/platform`.

## Notes
MRR/ARR are estimated from active subscriptions and the configured product plan prices ($29/$79/$199 monthly equivalents). The console deliberately does not impersonate tenants or mutate subscriptions; Stripe remains the billing source of truth.
