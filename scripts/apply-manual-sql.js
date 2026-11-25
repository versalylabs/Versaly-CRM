// Applies the Phase 6, 7 and 8 schema changes (prisma/manual/*.sql) to the database in DB_URL.
// Each file runs in one transaction: it applies fully or not at all.
// Usage (PowerShell): $env:DB_URL = Read-Host "Paste production database URL"; node scripts/apply-manual-sql.js
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const FILES = ['2026-11-25-phase6-mpesa.sql', '2026-11-25-phase7-messaging.sql', '2026-11-25-phase8-invoicing.sql'];
// A table each file creates; if it already exists, that file was applied before and is skipped.
const MARKER = { '2026-11-25-phase6-mpesa.sql': 'MpesaAccount', '2026-11-25-phase7-messaging.sql': 'SmsCreditLedger', '2026-11-25-phase8-invoicing.sql': 'SalesInvoice' };

const url = (process.env.DB_URL || '').trim();
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error('DB_URL is missing or does not start with postgres:// (paste it without quotes).');
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });

(async () => {
  try {
    for (const file of FILES) {
      const [{ exists }] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${MARKER[file]}"') IS NOT NULL AS exists`);
      if (exists) { console.log(`Skipped ${file} (already applied).`); continue; }
      const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'manual', file), 'utf8')
        .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));
      await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)));
      console.log(`Applied ${file} (${statements.length} changes).`);
    }
    console.log('All done.');
  } catch (e) {
    console.error('Failed (that file was not changed):', e.message.split('\n').slice(-3).join(' '));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
