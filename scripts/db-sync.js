const { execSync } = require('child_process');
const { resolveDatabaseUrl, prepareSchema } = require('./db-prepare');

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

    const versalyHashedPassword = await bcrypt.hash('labversaly-16', 10);
    const demoHashedPassword = await bcrypt.hash('password123', 10);

    const adminsToEnsure = [
      { email: 'demo@versaly.com', name: 'Demo Admin', password: demoHashedPassword },
      { email: 'versalylabs@gmail.com', name: 'Versaly Admin', password: versalyHashedPassword },
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
            password: admin.password,
            role: 'ADMIN',
            isActive: true,
            organizationId: org.id,
          },
        });
        console.log(`Created admin account: ${admin.email}`);
      } else {
        await prisma.user.update({
          where: { email: admin.email },
          data: {
            password: admin.password,
            isActive: true,
            role: 'ADMIN',
            organizationId: existing.organizationId || org.id,
          },
        });
        console.log(`Updated credentials for admin account: ${admin.email}`);
      }
    }
  } catch (err) {
    console.warn('Notice: admin seed check encountered:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const { dbUrl } = prepareSchema();

  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl;
    try {
      console.log('Synchronizing database schema to database...');
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
    console.log('No valid database URL found. Skipping auto-sync.');
  }
}

run();
