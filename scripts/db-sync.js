const { execSync } = require('child_process');

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (dbUrl && !dbUrl.includes('username:password@hostname') && !dbUrl.startsWith('file:')) {
  process.env.DATABASE_URL = dbUrl;
  try {
    console.log('Synchronizing database schema to live database...');
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    console.log('Database schema successfully synchronized.');
  } catch (err) {
    console.warn('Notice: prisma db push failed or was skipped:', err.message);
  }
} else {
  console.log('No valid live database URL found at build time. Skipping auto-sync.');
}
