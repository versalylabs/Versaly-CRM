import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getServerHealthConfiguration } from '../../../../lib/env';
export const dynamic = 'force-dynamic';
export async function GET() {
  const configuration = getServerHealthConfiguration();
  let database = 'ok';
  try { await prisma.$queryRawUnsafe('SELECT 1'); } catch (error) { console.error('Health check database failure', error); database = 'unavailable'; }
  const ready = configuration.ready && database === 'ok';
  return NextResponse.json({ status: ready ? 'ok' : 'degraded', ready, live: true, database, timestamp: new Date().toISOString(), environment: configuration.production ? 'production' : 'development', issues: configuration.issues }, { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
