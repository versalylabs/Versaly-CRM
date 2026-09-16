# Calendar & Scheduling

This update adds the CRM calendar for meetings, calls, follow-ups and property viewings.

Run:

```bash
npm install
npm run db:push
npm run dev
```

The first two commands install dependencies and add the `CalendarEvent` table to the existing SQLite database. Existing CRM data is preserved.

Current implementation stores and manages events inside the CRM. Google/Outlook synchronization can be added as the next integration phase.
