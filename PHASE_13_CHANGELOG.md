# Phase 13 Changelog — Customer Support & Account Management

## Customer workspace
- Added `/support` customer support center.
- Customers can create support tickets with category and priority.
- Customers can view their own tickets and public conversation history.
- Workspace ADMIN/MANAGER users can view workspace tickets; other users see only tickets they opened.
- Customers can reply, change ticket status, and continue support conversations while the workspace is subscription-read-only or platform-suspended.
- Internal platform notes are never returned by customer ticket APIs.

## Platform operations
- Added `/platform/support` support operations console.
- Search and filter customer tickets.
- Change ticket status and priority.
- Send customer replies by email when SMTP is configured.
- Add internal notes that remain platform-only.
- View organization plan/subscription context alongside each ticket.
- Suspend or reactivate a workspace from the support console.
- Suspension reason is required and stored.
- Suspension forces tenant CRM writes into read-only mode through subscription access checks.
- Added `/api/platform/audit` and a recent audit panel.

## Auditing
- Added `PlatformAuditLog` for support updates, replies, internal notes, suspension, and reactivation actions.

## Database
- Added `SupportTicket` and `SupportMessage` models.
- Added organization suspension fields.
- Added user relations for support requesters/message authors.

## Security
- Platform support APIs require `PLATFORM_ADMIN_EMAILS` authorization.
- Customer ticket APIs enforce organization boundaries and ticket ownership/management roles.
- Internal notes are excluded from all customer-facing ticket reads.
- Suspended users remain able to contact support, avoiding a support dead-end.
