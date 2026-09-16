const fs = require('fs');
const path = require('path');

// Next.js and Prisma load .env automatically, but this standalone Node script does not.
// Load .env first so `npm run production:check` behaves the same way as the app.
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.search(/\s+#/);
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
const issues = [];
const warnings = [];
for (const key of required) if (!process.env[key]?.trim()) issues.push(`${key} is required.`);
if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) issues.push('NEXTAUTH_SECRET must be at least 32 characters.');
if (process.env.NODE_ENV === 'production') {
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('https://')) issues.push('NEXTAUTH_URL must use HTTPS in production.');
  if ((process.env.DATABASE_URL || '').startsWith('file:')) warnings.push('SQLite requires a durable volume and tested backups in production.');
  if (!process.env.CRON_SECRET?.trim()) warnings.push('CRON_SECRET is not configured; protected scheduled automation cannot be enabled.');
  if (!process.env.PLATFORM_ADMIN_EMAILS?.trim()) warnings.push('PLATFORM_ADMIN_EMAILS is not configured; the platform owner console will be inaccessible.');
}
if (warnings.length) { console.warn('Production warnings:'); warnings.forEach(x => console.warn(`- ${x}`)); }
if (issues.length) { console.error('Production check failed:'); issues.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log('Production environment check passed.');
