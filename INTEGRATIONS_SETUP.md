# External Lead Capture & Integrations

## Website form
POST JSON to `/api/public/lead` with at least:
- `contactName` (or `name`)
- `email`

Optional fields: `companyName`, `phone`, `website`, `location`, `jobTitle`, `message`.

## Secure webhook
POST to `/api/integrations/leads` with header:

`X-API-Key: <LEAD_CAPTURE_API_KEY>`

The endpoint accepts the same lead fields plus `source` and `channel`. Examples:
- `META` or `FACEBOOK` -> Social Media
- `WEBSITE_FORM` -> Website Form
- `EVENT`, `REFERRAL`, `COLD_OUTREACH`, `OTHER`

## Workflow
New external leads are automatically:
1. Checked for duplicate email addresses.
2. Assigned to the least-loaded active agent/manager (unless disabled).
3. Given a high-priority response task due within 24 hours.
4. Logged in the activity timeline.
5. Optionally sent a welcome email if SMTP and `AUTO_WELCOME_EMAIL=true` are configured.

Set `LEAD_CAPTURE_ALLOWED_ORIGIN` to your production website origin for CORS restriction.
