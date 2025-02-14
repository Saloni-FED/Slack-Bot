# Slack Approval Bot Setup

This README provides instructions on how to set up your Slack app named "test-bot" to work with the provided Express.js server.

## Slack App Configuration

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and select your "test-bot" app.

2. Under "Basic Information", note down your "Signing Secret". You'll need this for the `SLACK_SIGNING_SECRET` environment variable.

3. Under "OAuth & Permissions":
   - Add the following bot token scopes:
     - `chat:write`
     - `commands`
     - `users:read`
   - Install the app to your workspace if you haven't already.
   - Note down the "Bot User OAuth Token". You'll need this for the `SLACK_BOT_TOKEN` environment variable.

4. Under "Slash Commands", create a new command:
   - Command: `/approval-test`
   - Request URL: `https://your-app-url.com/slack/commands/approval-test`
   - Short Description: "Request approval"
   - Usage Hint: "[request details]"

5. Under "Interactivity & Shortcuts":
   - Turn on Interactivity
   - Set the Request URL to: `https://your-app-url.com/slack/interactions`

6. Under "Event Subscriptions":
   - Turn on Enable Events
   - Set the Request URL to: `https://your-app-url.com/slack/events`

## Environment Variables

Create a `.env` file in your project root with the following variables:

