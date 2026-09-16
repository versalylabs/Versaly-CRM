# Straten CRM Deployment & First Admin Setup

## 1. Configure production environment variables

Set these values on the production server/platform:

- `DATABASE_URL` - production database connection string.
- `NEXTAUTH_SECRET` - a long, random, private secret. Never reuse the development placeholder.
- `NEXTAUTH_URL` - the public HTTPS URL of the CRM, for example `https://crm.example.com`.

Do not commit the production `.env` file to source control.

## 2. Install dependencies and prepare Prisma

```bash
npm ci
npx prisma generate
npx prisma db push
```

For a production database where you are using Prisma migrations, use your normal migration deployment workflow instead of `db push`.

## 3. Create the first administrator

Run this once against the production database:

```bash
npm run admin:create
```

The command asks for the administrator's name, email, and password. The password is required to be at least 12 characters.

You can also prefill the non-secret fields:

```bash
npm run admin:create -- --name "Jane Doe" --email admin@example.com
```

The command remains safe to rerun. If the email already exists, it asks for confirmation before promoting/updating that account as an administrator. Existing sessions are invalidated after an account is promoted or its password is changed.

## 4. Start the production server

```bash
npm run build
npm run start
```

Put the application behind HTTPS and a production reverse proxy/platform where appropriate.

## Important

Do **not** run the demo `prisma/seed.ts` against the production database. It intentionally clears data and is disabled when `NODE_ENV=production`.

Use `npm run admin:create` for the initial production administrator instead.


## Production hardening

Before every production deployment, run:

```bash
npm ci
npm run db:generate
npm run production:check
npm run build
```

See `PRODUCTION_HARDENING.md` for health checks, backups, and scheduled automation.
