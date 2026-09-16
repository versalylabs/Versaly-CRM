# Phase 15 — Integrations Hub & Developer API

Adds workspace-scoped API keys, a versioned `/api/v1/leads` endpoint, signed outbound webhooks, delivery telemetry, and an upgraded Integrations UI.

## API
- `POST /api/v1/leads` — create/capture a lead.
- `GET /api/v1/leads?search=` — list up to 100 workspace leads.
- Authenticate with `Authorization: Bearer <API_KEY>` or `X-API-Key`.

## Webhooks
Supported events: `lead.created`, `lead.updated`, `lead.stage_changed`, `task.created`, `task.completed`, `activity.created`, `calendar.created`, `workflow.executed`. Payloads include `id`, `event`, `createdAt`, and `data`. Requests are signed with `X-Straten-Signature: sha256=<HMAC-SHA256>`.

API keys and webhook endpoints are tenant isolated. Full secrets are only returned at creation time.
