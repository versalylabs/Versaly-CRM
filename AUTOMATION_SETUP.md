# Automation Workflows & Follow-up Sequences

## What is included

- Trigger workflows from outreach being sent or replied to.
- Trigger workflows when a lead changes pipeline stage.
- Scan for inactive leads and run inactivity workflows manually from the Automation page.
- Create follow-up tasks, move a lead to another pipeline stage, or set the next follow-up date.
- Keep execution history for completed, skipped, and failed workflow runs.
- Prevent duplicate open tasks from the same workflow.

## Examples

1. **Email follow-up**
   - Trigger: Outreach sent → Email
   - Action: Create follow-up task in 48 hours

2. **Reply handling**
   - Trigger: Lead replied
   - Action: Move pipeline stage to INTERESTED

3. **Cold lead recovery**
   - Trigger: Lead inactive for 7 days
   - Action: Create high-priority task after 1 hour

## Important behavior

This phase provides workflow rules and reliable event-driven automation. It does not run a background scheduler every minute. Inactivity rules are intentionally run from the Automation page using **Run inactivity scan**, which makes the feature safe to use in local development and before production deployment.

For production, the next enhancement can wire the inactivity scan to a cron job or hosting scheduler.
