const fs = require('fs');
const path = require('path');

// Load .env if not already loaded (local development convenience).
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const POSTGRES_PREFIXES = ['postgresql://', 'postgres://', 'prisma+postgres://'];

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
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 5 && !trimmed.includes('username:password@hostname') && POSTGRES_PREFIXES.some((p) => trimmed.startsWith(p))) {
      return trimmed;
    }
  }
  return null;
}

/**
 * The Prisma datasource provider is fixed to "postgresql" in schema.prisma.
 * (It used to be rewritten at build time between sqlite/postgresql, which made
 * the committed schema disagree with production.) Local development must use a
 * PostgreSQL database too, e.g. a free Neon branch or a local Postgres.
 */
function prepareSchema() {
  const dbUrl = resolveDatabaseUrl();
  return { dbUrl, isPostgres: Boolean(dbUrl), targetProvider: 'postgresql' };
}

if (require.main === module) {
  const r = prepareSchema();
  console.log(r.isPostgres ? 'PostgreSQL database URL found.' : 'No PostgreSQL database URL found.');
}

module.exports = { resolveDatabaseUrl, prepareSchema };
