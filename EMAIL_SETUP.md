# CRM Email Setup

The Email Workspace sends real email through an SMTP provider and automatically logs each successful send in the lead's outreach history and activity timeline.

## 1. Update the environment file

Copy the SMTP values into `.env`:

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
SMTP_SECURE="false"
SMTP_FROM="Straten Agency <hello@example.com>"
```

For port `465`, use `SMTP_SECURE="true"`.

Restart `npm run dev` after changing environment variables.

## 2. Update the database

This release adds the `EmailTemplate` table. Run:

```powershell
npm install
npm run db:push
npm run dev
```

Existing CRM data remains in place.

## 3. How sending works

1. Open **Email** in the sidebar.
2. Select a lead.
3. Choose a template or write from scratch.
4. Review the recipient, subject, and message.
5. Click **Send & Log Email**.

The CRM sends the email first. Only after the SMTP provider accepts it does the CRM create the outreach record, update the lead's last contact time, and add an activity event.

## Template variables

Templates can use:

- `{{contactName}}`
- `{{companyName}}`
- `{{email}}`

They are replaced automatically when a lead is selected.
