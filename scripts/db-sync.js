const { execSync } = require('child_process');

function resolveDatabaseUrl() {
  const candidates = [
    process.env.PRISMA_DATABASE_POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (
        trimmed.length > 5 &&
        !trimmed.includes('username:password@hostname') &&
        (trimmed.startsWith('postgresql://') ||
          trimmed.startsWith('postgres://') ||
          trimmed.startsWith('prisma+postgres://'))
      ) {
        return trimmed;
      }
    }
  }
  return null;
}

const dbUrl = resolveDatabaseUrl();

if (dbUrl) {
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

