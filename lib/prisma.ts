import { PrismaClient } from '@prisma/client'

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (dbUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = dbUrl;
}

const clientOptions = dbUrl && !dbUrl.includes('username:password@hostname')
  ? { datasources: { db: { url: dbUrl } } }
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