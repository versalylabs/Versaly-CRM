// Fails if an API route that changes workspace data skips the read-only subscription guard.
// Run: npm run qa:guards
const fs = require('fs');
const path = require('path');

const API = path.join(__dirname, '..', 'src', 'app', 'api');

// Routes allowed to write without blockIfReadOnly, and why.
const EXEMPT = {
  'admin/invitations': 'team management stays available when read-only',
  'admin/users': 'team management stays available when read-only',
  'admin/users/[id]': 'team management stays available when read-only',
  'auth/accept-invite': 'sign-up flow',
  'auth/register': 'sign-up flow',
  'auth/forgot-password': 'account recovery must always work',
  'auth/reset-password': 'account recovery must always work',
  'auth/verify-email': 'confirming an email is not a workspace data change',
  'automation/cron': 'system job, protected by CRON_SECRET',
  'billing/change-plan': 'billing must work to leave read-only mode',
  'billing/checkout': 'billing must work to leave read-only mode',
  'billing/auto-renew': 'billing must work to leave read-only mode',
  'billing/paystack-webhook': 'payment provider webhook',
  contact: 'public website form (platform workspace)',
  'inbox/conversations/[id]/read': 'marking as read is not a data change',
  'inbox/simulate': 'development-only tool',
  'inbox/sync': 'fetching mail keeps incoming messages flowing',
  'inbox/webhook': 'inbound messages keep flowing',
  'integrations/leads': 'platform-level lead webhook',
  'integrations/meta/webhook': 'inbound Meta lead webhook',
  'notification-preferences': 'personal preference',
  'notifications': 'personal notifications',
  'notifications/alerts': 'personal notifications',
  'notifications/read-all': 'personal notifications',
  'platform/organizations/[id]': 'platform staff console',
  'platform/support/[id]': 'platform staff console',
  'public/lead': 'public website form; inbound leads keep flowing',
  settings: 'profile must stay editable',
  'settings/password': 'password must stay changeable',
  'support/tickets': 'customers must reach support',
  'support/tickets/[id]': 'customers must reach support',
  'v1/leads': 'API-key auth: checks assertSubscriptionWriteAccess itself',
  'webhooks/communications/[channel]': 'inbound messages keep flowing',
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(API)) {
  const route = path.relative(API, path.dirname(file)).split(path.sep).join('/');
  const src = fs.readFileSync(file, 'utf8');
  const writes = src.match(/export async function (POST|PATCH|PUT|DELETE)\b/g) || [];
  if (!writes.length || EXEMPT[route]) continue;
  const guards = (src.match(/await blockIfReadOnly\(\)/g) || []).length;
  if (guards < writes.length) problems.push(`${route}: ${writes.length} write handler(s), ${guards} guard(s)`);
}

const v1 = fs.readFileSync(path.join(API, 'v1', 'leads', 'route.ts'), 'utf8');
if (!v1.includes('assertSubscriptionWriteAccess')) problems.push('v1/leads: missing assertSubscriptionWriteAccess');

if (problems.length) {
  console.error('Routes missing the read-only guard (add blockIfReadOnly or an EXEMPT entry with a reason):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('Route guard check passed.');
