# Automation Workflow Loading Fix

## Problem fixed
`GET /api/workflows` returned HTTP 500 even though workflow creation could succeed.

The endpoint attempted to use `include: { lead: ... }` on `AutomationExecution`, but the current Prisma schema stores `leadId` as a scalar field and does not define a Prisma `lead` relation on that model. This caused the workflow list request to fail, leaving the UI at zero workflows and making subsequent attempts with the same name return HTTP 409.

## Fix
- Workflow and execution records are loaded normally.
- Lead IDs from executions are collected and resolved in one separate `Lead.findMany` query.
- Lead names are attached to the response in memory.
- GET errors are now caught and logged with a clear `Could not load workflows.` response.
- No schema migration is required for this fix.

## Run
```powershell
npm install
npm run db:generate
npm run dev
```

Do not run `db:push` for this specific fix unless you are intentionally applying other pending schema changes.
