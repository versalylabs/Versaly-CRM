# Phase 17 — Customer Success & Retention

This phase adds a tenant-isolated customer-success workspace for managing customer health, lifecycle, milestones, and renewals.

## Included
- Customer Success page at `/customer-success`
- Tenant-scoped `CustomerSuccessRecord` and `CustomerMilestone` models
- Health scoring (0–100) based on recent activity, contact recency, task follow-through, outreach replies, and renewal proximity
- Health buckets: Healthy, Watch, At Risk
- Lifecycle stages: Onboarding, Adopting, Active, At Risk, Renewal, Churned
- Renewal date, renewal value and renewal status tracking
- Success-plan notes and milestone checklist
- At-risk and 30-day renewal visibility
- Secure API routes under `/api/customer-success`
- Customer-success navigation in the CRM sidebar
- Light-mode visual refinement: calmer workspace background, stronger hierarchy, rounded controls, cleaner focus states, and softer shadows

## Run

```powershell
npm install
npm run db:push
npm run dev
```

Open:
- CRM: http://localhost:3000/
- Customer Success: http://localhost:3000/customer-success

## Test
1. Sign in to an existing workspace.
2. Open Customer Success.
3. Add a customer using the lead ID of a lead in the same workspace.
4. Set lifecycle and renewal information.
5. Open Manage and add/complete milestones.
6. Confirm health, at-risk and renewal summaries remain workspace-specific.
