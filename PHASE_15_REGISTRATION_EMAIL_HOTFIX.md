# Phase 15 Hotfix — Tenant-scoped Lead Email Uniqueness

## Problem

New workspace registration could fail during onboarding with Prisma `P2002` on `Lead.email`.

The `Lead.email` field was still globally unique even though leads are now tenant-scoped. This meant two different organizations could not contain the same lead email, and the onboarding seed data could collide with an existing lead from another workspace.

## Fix

- Removed the global `@unique` constraint from `Lead.email`.
- Added a tenant-scoped composite unique constraint:
  - `@@unique([organizationId, email])`
- Existing lead records without an organization remain supported.
- Lead creation/update conflict handling now follows the tenant-scoped uniqueness model.

## Apply the fix

From the project directory:

```powershell
npm install
npm run db:push
npm run dev
```

Then try creating the workspace again from `/auth/signup`.

`prisma db push` will update the local SQLite schema and regenerate the Prisma client through the normal project workflow.

## Expected result

A lead email may be used in multiple workspaces, but the same email cannot be duplicated within the same workspace.

This is the correct behavior for a multi-tenant SaaS CRM.
