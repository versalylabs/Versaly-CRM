# Phase 15 — Integrations & Developer API Changelog

## Added
- Workspace-scoped API keys with SHA-256 storage, prefix display, expiry and revocation.
- Versioned developer API at `/api/v1/leads` for lead creation and read access.
- Workspace-scoped outbound webhook endpoints.
- HMAC-SHA256 webhook signatures via `X-Straten-Signature`.
- Webhook delivery history, status codes, responses and failure counters.
- Integrations UI for API key and webhook administration.
- Tenant-aware external lead capture assignment and persistence.
- `PHASE_15_INTEGRATIONS_DEVELOPER_API.md` implementation documentation.

## Security
- API secrets are never persisted in plaintext.
- Full API/webhook secrets are returned only during creation.
- API keys, webhook endpoints and deliveries are organization scoped.
- API mutations require an ADMIN or MANAGER workspace role.
