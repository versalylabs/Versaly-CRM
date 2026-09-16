const isProduction = process.env.NODE_ENV === 'production';
function value(name: string) { const raw = process.env[name]?.trim(); return raw ? raw : undefined; }

export function getProductionEnvironmentIssues() {
  const issues: string[] = [];
  for (const name of ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']) if (!value(name)) issues.push(`${name} is not configured.`);
  const secret = value('NEXTAUTH_SECRET');
  if (secret && secret.length < 32) issues.push('NEXTAUTH_SECRET must be at least 32 characters.');
  if (isProduction) {
    const url = value('NEXTAUTH_URL');
    if (url && !url.startsWith('https://')) issues.push('NEXTAUTH_URL should use HTTPS in production.');
    if (value('DATABASE_URL')?.startsWith('file:')) issues.push('DATABASE_URL is using SQLite. Use a managed production database or a durable volume with tested backups.');
    if (!value('CRON_SECRET')) issues.push('CRON_SECRET is required when production automations are enabled.');
  }
  return issues;
}
export function getCronSecret() { return value('CRON_SECRET'); }
export function getServerHealthConfiguration() { const issues=getProductionEnvironmentIssues(); return { production:isProduction, ready:issues.length===0, issues }; }
