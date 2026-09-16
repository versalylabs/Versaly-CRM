# Phase 16 — Advanced Reporting, BI & Customer Analytics

## Included
- Tenant-isolated reporting API with team/my scope controls.
- Executive KPIs: lead volume, conversion, active pipeline, won/lost value, average won deal size, outreach reply rate, proposal win rate, task completion and sales-cycle duration.
- Pipeline forecasting using explicit stage probabilities.
- Deal aging buckets for active opportunities.
- Lead-source attribution and pipeline-stage analysis.
- Outreach and proposal performance summaries.
- Team/member performance for managers and admins.
- Date-range controls (30/90/365 days or all time).
- CSV export and browser print/PDF workflow.
- Existing report page enhanced without introducing a new charting dependency.

## Test
1. `npm install`
2. `npm run db:push`
3. `npm run dev`
4. Open `http://localhost:3000/reports`.
5. Test Team Performance/My Metrics if signed in as a manager/admin.
6. Change the date range and confirm values update.
7. Click **Export CSV** and verify the downloaded report is scoped to the current tenant/range.
8. Click **Print / PDF** to use the browser print dialog.

No AI CRM Assistant functionality is included in this roadmap phase.
