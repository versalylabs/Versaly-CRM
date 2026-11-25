// One-off diagnostic: prints the structure (no row data) of the EmailTemplate table.
// Usage (PowerShell): $env:DB_URL = Read-Host "URL"; node scripts/check-email-template-schema.js
const { PrismaClient } = require('@prisma/client');

const url = process.env.DB_URL;
if (!url) {
  console.error('Set DB_URL first.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

(async () => {
  try {
    const db = await prisma.$queryRawUnsafe('SELECT current_database() AS db, inet_server_addr()::text AS server');
    console.log('Connected to:', JSON.stringify(db));
    const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'EmailTemplate' ORDER BY ordinal_position`);
    console.log('Columns:', cols.map((c) => c.column_name).join(', '));
    const idx = await prisma.$queryRawUnsafe(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'EmailTemplate'`);
    console.log('Indexes:');
    idx.forEach((i) => console.log(' -', i.indexname, '=>', i.indexdef));
    const fks = await prisma.$queryRawUnsafe(`SELECT conname FROM pg_constraint WHERE conrelid = '"EmailTemplate"'::regclass`);
    console.log('Constraints:', fks.map((c) => c.conname).join(', '));
  } catch (e) {
    console.error('Check failed:', e.message.split('\n').slice(-3).join(' '));
  } finally {
    await prisma.$disconnect();
  }
})();
