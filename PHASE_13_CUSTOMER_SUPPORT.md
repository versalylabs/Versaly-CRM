# Phase 13 — Customer Support & Account Management

This phase adds customer support operations and platform-level account controls.

## Included
- Tenant-isolated customer support tickets and threaded replies.
- Ticket status, priority, and category.
- Platform support console with organization/customer context.
- Internal platform-only notes on support tickets.
- Platform audit log for support actions and account suspension/reactivation.
- Workspace suspension controls that force the tenant into read-only access.
- Customer-facing suspension messaging.
- Support navigation in the CRM.

## Local setup
```powershell
npm install
npm run db:push
npm run dev
```

Customer support: `http://localhost:3000/support`
Platform support: `http://localhost:3000/platform/support`
Platform analytics: `http://localhost:3000/platform`

Platform access continues to use `PLATFORM_ADMIN_EMAILS` in `.env`.
