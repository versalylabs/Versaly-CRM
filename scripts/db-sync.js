const { execSync } = require('child_process');
const { resolveDatabaseUrl, prepareSchema } = require('./db-prepare');

/**
 * Build-time schema sync.
 *
 * SAFETY NOTES
 * - No default accounts or passwords are created here. Create administrators
 *   with `npm run admin:create` (interactive).
 * - `prisma db push` is run WITHOUT `--accept-data-loss`. If a schema change
 *   would destroy data, the push fails and the build stops instead of silently
 *   deleting customer data. Apply such changes deliberately (ideally with
 *   `prisma migrate`) after taking a backup.
 */
async function run() {
  const { dbUrl, isPostgres } = prepareSchema();

  if (!dbUrl || !isPostgres) {
    console.log('No PostgreSQL database URL found. Skipping auto-sync.');
    return;
  }

  process.env.DATABASE_URL = dbUrl;
  try {
    console.log('Synchronizing database schema (non-destructive)...');
    execSync('npx prisma db push', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    console.log('Database schema successfully synchronized.');
  } catch (err) {
    console.error('Database schema sync FAILED:', err.message);
    console.error('Refusing to continue: review the schema change and apply it manually after a backup.');
    process.exit(1);
  }
}

run();
