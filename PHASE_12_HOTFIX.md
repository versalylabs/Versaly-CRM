# Phase 12 Hotfix

This hotfix fixes two issues found during local validation:

1. `npm run production:check` now loads `.env`, matching how Next.js and Prisma load environment variables.
2. Middleware now bypasses WebSocket/HMR upgrade requests and explicitly excludes Next.js's development HMR endpoint to prevent the repeated `Error handling upgrade request ... bind` noise observed during `npm run dev`.

## Run

```powershell
npm install
npm run db:push
npm run production:check
npm run dev
```

If `production:check` reports a missing value after this hotfix, the value is genuinely absent from `.env`; copy `.env.example` to `.env` and configure the required values.
