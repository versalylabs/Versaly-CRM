# Production Hardening & Deployment

## What this phase adds

- Environment validation before deployment
- `/api/health` readiness endpoint
- Security response headers
- Protected scheduled automation endpoint
- Safer production deployment checklist
- `.gitignore` rules for secrets and local database files

## 1. Environment

Required in production:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Recommended for scheduled automation:

- `CRON_SECRET`

Generate long random values for both secrets. Never commit production secrets.

## 2. Production checks

Run:

```bash
npm ci
npm run db:generate
npm run production:check
npm run build
```

If using SQLite, production storage must be durable and backed up. For multi-instance or serverless deployment, use a managed production database and update the Prisma provider/schema accordingly.

## 3. Health check

Use:

```text
GET /api/health
```

A healthy application returns `200` with `ready: true`.

## 4. Scheduled automation

The endpoint is:

```text
POST /api/automation/cron
Authorization: Bearer <CRON_SECRET>
```

Schedule it hourly or daily depending on the desired follow-up responsiveness. The endpoint runs the existing inactive-lead workflow engine and returns execution results.

## 5. Backup strategy

- Managed database: enable automated backups and point-in-time recovery.
- SQLite: back up the database file from a durable volume, test restores regularly, and stop writes during file snapshots when required by your hosting environment.
- Keep backups outside the application server and encrypt them where supported.

## 6. Deployment order

1. Back up the production database.
2. Set production environment variables.
3. Run `npm ci`.
4. Run `npm run db:generate`.
5. Apply database changes using your production-safe Prisma workflow.
6. Run `npm run production:check`.
7. Run `npm run build`.
8. Deploy and start the application.
9. Verify `/api/health`.
10. Verify sign-in, lead creation, Calendar, communication sending, and Automation.
11. Enable the protected scheduler only after the manual automation test succeeds.
