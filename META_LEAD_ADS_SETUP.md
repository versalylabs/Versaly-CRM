# Meta / Facebook Lead Ads Setup

## 1. Create and configure a Meta app
Create a Meta app for your business and add the Webhooks product. Subscribe the relevant Facebook Page to the `leadgen` field.

## 2. Configure environment variables
Set `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `META_PAGE_ACCESS_TOKEN` in `.env`. The page token must have the permissions required by your Meta app and Page to retrieve Lead Ads data.

## 3. Webhook callback
Use:

`https://YOUR-DOMAIN/api/integrations/meta/webhook`

Meta verifies the endpoint with `GET`. The CRM verifies Meta webhook signatures using `X-Hub-Signature-256`, then retrieves the lead data from the Graph API.

## 4. Test
Use Meta's Webhooks test tool with a real Page/Lead Ads subscription. Localhost must be exposed through HTTPS for Meta to reach it. A tunnel such as ngrok can be used for development.

## Workflow
Meta Lead Ad -> signed webhook -> Graph API lead lookup -> duplicate check -> CRM lead -> automatic assignment -> high-priority response task -> optional welcome email.
