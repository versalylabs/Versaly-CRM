const baseUrl = (process.env.SMOKE_TEST_URL || 'http://localhost:3000').replace(/\/$/, '');
const endpoints = [
  '/api/health',
  '/auth/signin',
];

async function main() {
  console.log(`Running smoke tests against ${baseUrl}`);
  let failed = false;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { redirect: 'manual' });
      const ok = endpoint === '/auth/signin'
        ? [200, 301, 302, 307, 308].includes(response.status)
        : response.ok;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${endpoint} -> ${response.status}`);
      if (!ok) failed = true;
    } catch (error) {
      console.log(`FAIL ${endpoint} -> ${error.message}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('Smoke tests passed.');
}

main();
