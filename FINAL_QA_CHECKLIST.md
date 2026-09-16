# Straten CRM — Final QA Checklist

This phase is intentionally focused on verifying the completed CRM without rewriting working feature code.

## 1. Automated structural QA

Run:

```bash
npm run qa:final
```

This verifies that the major CRM pages and API routes are present, required Prisma models exist, production environment variables are documented, health checks are configured, security headers are present, and client-component directives are correctly positioned.

## 2. Production environment check

```bash
npm run production:check
```

Confirm that production secrets and URLs are configured before deployment.

## 3. Database check

For a new or changed environment:

```bash
npm run db:generate
npm run db:push
```

Back up the production database before applying schema changes.

## 4. Manual application walkthrough

Sign in and test the following:

- Dashboard loads without errors.
- Leads can be created, edited, searched, and deleted.
- Pipeline stage changes persist.
- Outreach records are created and visible in lead context.
- Proposals can be created and updated.
- Tasks can be created, assigned, completed, and reopened.
- Calendar events can be created and marked complete.
- Email workspace sends or records communication correctly.
- WhatsApp integration is validated with configured credentials.
- Notifications load and can be marked read.
- Automation workflows load, create, activate/deactivate, and execute.
- Reports display figures in Kenyan Shillings where monetary values are shown.
- Settings persist the selected light/dark theme.
- Admin-only pages reject non-admin users.

## 5. Automated workflow check

Create a test workflow with a non-production test lead. Trigger it once and confirm:

- The execution is recorded.
- The expected task or stage change happens exactly once.
- Repeating the same event does not create unintended duplicates.

## 6. Health check

After the application is running:

```bash
npm run qa:smoke
```

For another deployment URL:

```bash
SMOKE_TEST_URL=https://your-domain.example npm run qa:smoke
```

The health endpoint should report `ready: true` before launch.

## 7. Production build gate

Before deployment, run:

```bash
npm run qa:final
npm run production:check
npm run db:generate
npm run build
```

Do not deploy until all four commands complete successfully.
