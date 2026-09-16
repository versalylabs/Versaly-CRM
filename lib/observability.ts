export function logEvent(event: string, details: Record<string, unknown> = {}) {
  // Structured logs are easy to ingest by Vercel, Render, Fly, Datadog, etc.
  console.info(JSON.stringify({ level: 'info', event, timestamp: new Date().toISOString(), ...details }));
}

export function logError(event: string, error: unknown, details: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: 'error', event, message, timestamp: new Date().toISOString(), ...details }));
}
