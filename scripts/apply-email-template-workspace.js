// One-off: applies the EmailTemplate per-workspace schema change using the Prisma client connection.
// Same statements as scripts/one-off-email-template-workspace.sql, run in a single transaction.
// Usage (PowerShell): $env:DB_URL = Read-Host "URL"; node scripts/apply-email-template-workspace.js
const { PrismaClient } = require('@prisma/client');

const url = process.env.DB_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url.trim())) {
  console.error('DB_URL is missing or does not start with postgres:// or postgresql:// (paste it without quotes).');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url.trim() });

const statements = [
  `ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`,
  `DROP INDEX IF EXISTS "EmailTemplate_name_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_organizationId_name_key" ON "EmailTemplate"("organizationId", "name")`,
  `CREATE INDEX IF NOT EXISTS "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplate_organizationId_fkey') THEN
       ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey"
         FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

(async () => {
  try {
    await prisma.$transaction(statements.map((sql) => prisma.$executeRawUnsafe(sql)));
    console.log('Applied successfully. Now run: node scripts/check-email-template-schema.js');
  } catch (e) {
    console.error('Failed (nothing was changed):', e.message.split('\n').slice(-4).join(' '));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
