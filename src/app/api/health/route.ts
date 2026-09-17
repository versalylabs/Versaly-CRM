import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getServerHealthConfiguration } from '../../../../lib/env';
export const dynamic = 'force-dynamic';
export async function GET() {
  const configuration = getServerHealthConfiguration();
  let database = 'ok';
  let dbError: string | null = null;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch (error: any) {
    console.error('Health check database failure', error);
    database = 'unavailable';
    dbError = error?.message || String(error);
  }
  const hasDbUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 5);
  const ready = configuration.ready && database === 'ok';
  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      ready,
      live: true,
      database,
      databaseConfigured: hasDbUrl,
      databaseError: dbError,
      timestamp: new Date().toISOString(),
      environment: configuration.production ? 'production' : 'development',
      hasPrismaDatabasePostgresUrl: Boolean(process.env.PRISMA_DATABASE_POSTGRES_URL),
      issues: configuration.issues,
    },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
