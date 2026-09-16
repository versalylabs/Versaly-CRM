# Straten CRM — Production Launch Readiness

## Required before going live

- [ ] Production `DATABASE_URL` configured.
- [ ] Production database backup process tested.
- [ ] `NEXTAUTH_SECRET` is unique and at least 32 characters.
- [ ] `NEXTAUTH_URL` uses the final HTTPS domain.
- [ ] `CRON_SECRET` configured if scheduled automation is enabled.
- [ ] SMTP credentials configured and tested.
- [ ] Meta WhatsApp credentials configured and tested if WhatsApp sending is enabled.
- [ ] At least one administrator account exists.
- [ ] `npm run qa:final` passes.
- [ ] `npm run production:check` passes.
- [ ] `npm run build` passes.
- [ ] `/api/health` returns HTTP 200 and `ready: true`.
- [ ] `npm run qa:smoke` passes against the deployed application.

## Recommended launch sequence

1. Back up the database.
2. Apply database changes.
3. Generate the Prisma client.
4. Run the production check.
5. Build the application.
6. Deploy the application.
7. Verify `/api/health`.
8. Run the smoke test against the live URL.
9. Send one test email and one test WhatsApp message if enabled.
10. Trigger one test automation workflow.
11. Monitor logs during the first operating period.

## Rollback

Keep the previous working deployment available. If the new release fails the health check or critical smoke tests:

1. Roll back application code.
2. Restore the database only if a destructive migration was applied.
3. Disable external cron triggers until the system is stable.
4. Review application logs before attempting another deployment.
