const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read .env if not loaded
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

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
          trimmed.startsWith('prisma+postgres://') ||
          trimmed.startsWith('file:'))
      ) {
        return trimmed;
      }
    }
  }
  return 'file:./dev.db';
}

function prepareSchema() {
  const dbUrl = resolveDatabaseUrl();
  const isPostgres =
    dbUrl.startsWith('postgresql://') ||
    dbUrl.startsWith('postgres://') ||
    dbUrl.startsWith('prisma+postgres://');
  const targetProvider = isPostgres ? 'postgresql' : 'sqlite';
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Target provider specifically inside datasource db block
  const datasourceBlockRegex = /datasource\s+db\s*\{[\s\S]*?\}/;
  const datasourceBlockMatch = schemaContent.match(datasourceBlockRegex);

  if (!datasourceBlockMatch) {
    console.warn('[db-prepare] Could not locate "datasource db" block in schema.prisma');
    return { dbUrl, isPostgres, targetProvider };
  }

  const datasourceBlock = datasourceBlockMatch[0];
  const currentProviderMatch = datasourceBlock.match(/provider\s*=\s*"([^"]+)"/);
  const currentProvider = currentProviderMatch ? currentProviderMatch[1] : null;

  if (currentProvider !== targetProvider) {
    console.log(`[db-prepare] Switching Prisma datasource provider from "${currentProvider}" to "${targetProvider}"`);
    const newDatasourceBlock = datasourceBlock.replace(/provider\s*=\s*"[^"]+"/, `provider = "${targetProvider}"`);
    schemaContent = schemaContent.replace(datasourceBlock, newDatasourceBlock);
    fs.writeFileSync(schemaPath, schemaContent, 'utf8');
    
    console.log('[db-prepare] Regenerating Prisma Client...');
    execSync('npx prisma generate', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl }
    });
  } else {
    console.log(`[db-prepare] Prisma datasource provider is already "${targetProvider}".`);
  }

  return { dbUrl, isPostgres, targetProvider };
}

if (require.main === module) {
  prepareSchema();
}

module.exports = { resolveDatabaseUrl, prepareSchema };
