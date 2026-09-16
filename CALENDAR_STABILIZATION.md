# Calendar Stabilization Update

This update focuses on reliability rather than changing the existing calendar UI.

## Fixed
- Provider-safe active-user resolution for stale NextAuth session IDs
- No unsupported Prisma `mode: "insensitive"` usage
- Reliable "Assign to me" fallback
- Agents only see their own events
- Managers/Admins can view the team calendar
- Event creation validates dates, lead IDs, assignees, and event types
- Added API support for completing/reopening events
- Added API support for deleting events

## No database migration required
Run `npm install`, `npm run db:generate`, and `npm run dev`.
