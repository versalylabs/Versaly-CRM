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

async function ensureDefaultAdmins(activeUrl) {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');

  const prisma = new PrismaClient({
    datasources: { db: { url: activeUrl } },
  });

  try {
    let org = await prisma.organization.findFirst({
      where: { slug: 'versaly-hq' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Versaly Labs',
          slug: 'versaly-hq',
          plan: 'GROWTH_PRO',
          planStatus: 'active',
          leadLimit: 5000,
          seatLimit: 10,
          currency: 'KES',
        },
      });
      console.log('Created default organization: Versaly Labs (versaly-hq)');
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    const adminsToEnsure = [
      { email: 'demo@versaly.com', name: 'Demo Admin' },
      { email: 'versalylabs@gmail.com', name: 'Versaly Admin' },
    ];

    for (const admin of adminsToEnsure) {
      const existing = await prisma.user.findUnique({
        where: { email: admin.email },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            name: admin.name,
            email: admin.email,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
            organizationId: org.id,
          },
        });
        console.log(`Created admin account: ${admin.email}`);
      }
    }
  } catch (err) {
    console.warn('Notice: admin seed check encountered:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

const dbUrl = resolveDatabaseUrl();

async function run() {
  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl;
    try {
      console.log('Synchronizing database schema to live database...');
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
      console.log('Database schema successfully synchronized.');

      console.log('Verifying default administrative accounts...');
      await ensureDefaultAdmins(dbUrl);
    } catch (err) {
      console.warn('Notice: prisma db push or admin seed failed or was skipped:', err.message);
    }
  } else {
    console.log('No valid live database URL found at build time. Skipping auto-sync.');
  }
}

run();


