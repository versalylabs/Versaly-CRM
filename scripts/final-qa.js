const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];
const passes = [];

function file(relative) {
  return path.join(root, relative);
}

function exists(relative, label = relative) {
  if (!fs.existsSync(file(relative))) failures.push(`Missing: ${label}`);
  else passes.push(`Present: ${label}`);
}

function read(relative) {
  return fs.readFileSync(file(relative), 'utf8');
}

function check(condition, message, warning = false) {
  if (condition) passes.push(message);
  else if (warning) warnings.push(message);
  else failures.push(message);
}

const requiredPages = [
  'src/app/page.tsx',
  'src/app/leads/page.tsx',
  'src/app/pipeline/page.tsx',
  'src/app/outreach/page.tsx',
  'src/app/proposals/page.tsx',
  'src/app/tasks/page.tsx',
  'src/app/activity/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/email/page.tsx',
  'src/app/whatsapp/page.tsx',
  'src/app/calendar/page.tsx',
  'src/app/integrations/page.tsx',
  'src/app/notifications/page.tsx',
  'src/app/automation/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/copilot/page.tsx',
  'src/app/inbox/page.tsx',
];

const requiredApiRoutes = [
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/leads/route.ts',
  'src/app/api/tasks/route.ts',
  'src/app/api/outreach/route.ts',
  'src/app/api/proposals/route.ts',
  'src/app/api/calendar/route.ts',
  'src/app/api/communications/route.ts',
  'src/app/api/email/send/route.ts',
  'src/app/api/whatsapp/send/route.ts',
  'src/app/api/workflows/route.ts',
  'src/app/api/workflows/run/route.ts',
  'src/app/api/automation/cron/route.ts',
  'src/app/api/notifications/route.ts',
  'src/app/api/reports/route.ts',
  'src/app/api/copilot/overview/route.ts',
  'src/app/api/inbox/conversations/route.ts',
  'src/app/api/inbox/channels/route.ts',
];

requiredPages.forEach((item) => exists(item, `page ${item}`));
requiredApiRoutes.forEach((item) => exists(item, `API route ${item}`));

const pkg = JSON.parse(read('package.json'));
['dev', 'build', 'start', 'db:generate', 'production:check', 'qa:final', 'qa:smoke'].forEach((script) => {
  check(Boolean(pkg.scripts?.[script]), `package.json contains ${script} script`);
});

const schema = read('prisma/schema.prisma');
['model Lead', 'model Task', 'model CalendarEvent', 'model Proposal', 'model EmailTemplate', 'model AutomationWorkflow', 'model AutomationExecution', 'model Notification', 'model User', 'model AiDealInsight', 'model AiMeetingSummary', 'model Conversation', 'model ConversationMessage', 'model ConnectedChannelAccount'].forEach((token) => {
  check(schema.includes(token), `Prisma schema contains ${token}`);
});

const envExample = read('.env.example');
['DATABASE_URL=', 'NEXTAUTH_URL=', 'NEXTAUTH_SECRET=', 'CRON_SECRET=', 'SMTP_HOST=', 'WHATSAPP_PHONE_NUMBER_ID='].forEach((token) => {
  check(envExample.includes(token), `.env.example documents ${token}`);
});

const health = read('src/app/api/health/route.ts');
check(health.includes('status: ready ? 200 : 503'), 'Health route returns readiness HTTP status');
check(health.includes("'Cache-Control': 'no-store'"), 'Health route disables caching');

const config = read('next.config.js');
check(config.includes('poweredByHeader: false'), 'X-Powered-By header is disabled');
check(config.includes('X-Content-Type-Options'), 'Security headers are configured');

const middleware = read('src/middleware.ts');
check(middleware.includes("pathname.startsWith('/admin')"), 'Admin middleware protection is present');
check(middleware.includes("pathname.startsWith('/api/')"), 'API authorization remains delegated to route handlers');

// Client component directive must be the first executable statement.
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next'].includes(entry.name)) walk(full, files);
    if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

for (const full of walk(file('src'))) {
  const content = fs.readFileSync(full, 'utf8');
  const directiveIndex = content.indexOf("'use client'") >= 0 ? content.indexOf("'use client'") : content.indexOf('"use client"');
  if (directiveIndex >= 0) {
    const before = content.slice(0, directiveIndex).replace(/^\uFEFF/, '').trim();
    check(before === '', `Client directive is first in ${path.relative(root, full)}`);
  }
}

console.log('\nVersaly CRM Final QA Check\n');
console.log(`Passed checks: ${passes.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Failures: ${failures.length}\n`);

if (warnings.length) {
  console.log('WARNINGS');
  warnings.forEach((item) => console.log(`- ${item}`));
  console.log('');
}

if (failures.length) {
  console.log('FAILED');
  failures.forEach((item) => console.log(`- ${item}`));
  process.exit(1);
}

console.log('Final QA structural checks passed.');
