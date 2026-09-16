# Phase 14 — Advanced Automations & Workflow Engine

Phase 14 upgrades the existing automation module into a tenant-isolated workflow engine.

## Included
- Workspace-scoped workflows and execution history.
- Triggers for lead creation, stage changes, task creation/completion, lead updates, activity, outreach, and inactivity.
- Conditions for pipeline stage, source, priority, assignee, inactivity, and custom lead fields.
- Actions for task creation, stage changes, assignment, internal notes, email notifications, follow-up activities, and follow-up dates.
- Duplicate-execution protection with deterministic execution keys.
- Monthly automation run limits by plan: Starter 100, Growth Pro 1,000, Enterprise 10,000.
- Execution history and failure reporting.
- Platform automation usage endpoint at `/api/platform/automation`.
- Inactivity scan remains compatible with the existing cron endpoint.
- Existing automation APIs are now tenant scoped.

## Upgrade
1. Replace the previous project with this ZIP.
2. Run `npm install` if needed.
3. Run `npm run db:push`.
4. Run `npm run dev`.
5. Open `/automation` after signing in.

SMTP must be configured for the Send Email action to actually send mail; otherwise the execution is recorded as skipped with a clear message.
