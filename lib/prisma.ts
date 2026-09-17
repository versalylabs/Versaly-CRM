import { PrismaClient } from '@prisma/client'

function resolveDatabaseUrl(): string | undefined {
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
  return undefined;
}

const activeDbUrl = resolveDatabaseUrl();
if (activeDbUrl) {
  process.env.DATABASE_URL = activeDbUrl;
}

const clientOptions = activeDbUrl
  ? { datasources: { db: { url: activeDbUrl } } }
  : {};

let prisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(clientOptions as any)
} else {
  // In development, we need to avoid creating multiple instances
  // @ts-ignore
  if (!global.prisma) {
    // @ts-ignore
    global.prisma = new PrismaClient(clientOptions as any)
  }
  // @ts-ignore
  prisma = global.prisma
}

export default prisma