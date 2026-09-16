# Phase 12 — Production Readiness, Security & SaaS Deployment

## Implemented hardening
- Request IDs are attached to application responses.
- Sensitive public endpoints have rate limits for signup, credential login, invite acceptance, and public lead capture.
- Production security headers now include CSP, HSTS, COOP and CORP in addition to the existing anti-sniffing and referrer controls.
- `/api/health` provides readiness plus database status and `/api/health/live` provides a liveness probe.
- Production environment validation rejects weak authentication secrets and highlights missing production requirements.
- Stripe webhook processing now records processed event IDs and safely ignores duplicate deliveries.
- Structured JSON logging was added for webhook processing.

## Important scaling note
The included limiter uses process-local memory. It is appropriate for local development and a single application instance. Before horizontally scaling production, replace `lib/rateLimit.ts` with a shared Redis/KV implementation.

## Production commands
1. `npm install`
2. Configure `.env`
3. `npm run db:push` for a simple deployment, or adopt versioned Prisma migrations for managed production databases.
4. `npm run production:check`
5. `npm run build`
6. `npm start`

## Health probes
- Liveness: `/api/health/live`
- Readiness: `/api/health`

## Recommended deployment order
1. Configure domain and HTTPS.
2. Use a durable production database with tested backups.
3. Set strong 32+ character secrets.
4. Configure Stripe live keys and webhook endpoint.
5. Configure SMTP production credentials.
6. Add `PLATFORM_ADMIN_EMAILS`.
7. Run production check and build.
8. Verify liveness/readiness probes.
9. Test signup, checkout, webhook delivery, invite email and subscription recovery.

## Phase 13 recommendation
Customer Support & Account Management: support tickets, customer account controls, tenant notes, subscription support actions, and audited platform-owner operations.
