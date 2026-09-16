# Email Integration & Unified Communication History

This phase adds a real SMTP-backed Email Workspace and turns Outreach into a unified communication history.

## Included

- SMTP email configuration and connection status
- Compose and send email directly from the CRM
- Automatic outreach and activity logging after successful delivery
- Reusable email templates with personalization variables
- Unified communication API for Email, WhatsApp, calls, SMS, social channels, and manual outreach
- Channel-level summary counts in Outreach
- Direct Email and WhatsApp quick actions from each lead
- Lead preselection when opening Email or WhatsApp from a lead profile

## Setup

Add SMTP settings to `.env`, then run:

```powershell
npm install
npm run db:push
npm run db:generate
npm run dev
```

The `db:push` command is required because this phase uses the `EmailTemplate` model.

## Template variables

- `{{contactName}}`
- `{{companyName}}`
- `{{email}}`

## Unified history

Open **Outreach** to see the consolidated communication history. Email and WhatsApp sends created from their dedicated workspaces are automatically written into the same lead communication record stream.
