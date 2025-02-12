/**
 * Slack Approval Bot
 * This bot enables an approval workflow in Slack where users can request approvals
 * from other team members using a slash command.
 */

const { App } = require('@slack/bolt');
require('dotenv').config();

// Initialize the Slack app with required tokens
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

/**
 * In-memory storage for pending approvals
 * In production, consider using a persistent database
 * @type {Map<string, Object>}
 */
const pendingApprovals = new Map();

/**
 * Handles the /approval-test slash command
 * Opens a modal for users to submit approval requests
 */
app.command('/approval-test', async ({ command, ack, client, body }) => {
  // Acknowledge the command request immediately
  await ack();

  try {
    // Fetch list of workspace users for the approver selection dropdown
    const result = await client.users.list();
    const users = result.members
      .filter(user => !user.is_bot && user.id !== 'USLACKBOT')
      .map(user => ({
        text: {
          type: 'plain_text',
          text: user.real_name || user.name
        },
        value: user.id
      }));

    // Open modal with approval request form
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'approval_modal',
        title: {
          type: 'plain_text',
          text: 'Request Approval'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'approver_block',
            label: {
              type: 'plain_text',
              text: 'Select Approver'
            },
            element: {
              type: 'static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select an approver'
              },
              options: users,
              action_id: 'approver_select'
            }
          },
          {
            type: 'input',
            block_id: 'approval_text_block',
            label: {
              type: 'plain_text',
              text: 'Approval Request Details'
            },
            element: {
              type: 'plain_text_input',
              multiline: true,
              action_id: 'approval_text_input'
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  } catch (error) {
    console.error('Error handling slash command:', error);
  }
});

/**
 * Handles the submission of the approval request modal
 * Sends approval request to the selected approver
 */
app.view('approval_modal', async ({ ack, body, view, client }) => {
  await ack();

  // Extract form values
  const approver = view.state.values.approver_block.approver_select.selected_option.value;
  const approvalText = view.state.values.approval_text_block.approval_text_input.value;
  const requesterId = body.user.id;

  // Generate unique ID for this approval request
  const approvalId = `approval_${Date.now()}`;

  // Store approval request in memory
  pendingApprovals.set(approvalId, {
    requesterId,
    approver,
    approvalText,
    status: 'pending'
  });

  try {
    // Send approval request to approver
    await client.chat.postMessage({
      channel: approver,
      text: `New approval request from <@${requesterId}>: ${approvalText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `You have a new approval request from <@${requesterId}>:\n\n>${approvalText}`
          }
        },
        {
          type: 'actions',
          block_id: 'approval_actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve'
              },
              style: 'primary',
              value: approvalId,
              action_id: 'approve_request'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Reject'
              },
              style: 'danger',
              value: approvalId,
              action_id: 'reject_request'
            }
          ]
        }
      ]
    });

    // Notify requester that their request was sent
    await client.chat.postMessage({
      channel: requesterId,
      text: `Your approval request has been sent to <@${approver}>.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your approval request has been sent to <@${approver}>.`
          }
        }
      ]
    });
  } catch (error) {
    console.error('Error sending approval request:', error);
  }
});

/**
 * Handles the approval button action
 * Updates the approval status and notifies the requester
 */
app.action('approve_request', async ({ ack, body, client }) => {
  await ack();
  const approvalId = body.actions[0].value;
  const approval = pendingApprovals.get(approvalId);

  if (approval) {
    approval.status = 'approved';
    
    // Notify requester of approval
    await client.chat.postMessage({
      channel: approval.requesterId,
      text: `Your request has been approved by <@${body.user.id}>!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your request has been approved by <@${body.user.id}>!`
          }
        }
      ]
    });

    // Update original approval request message
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Request from <@${approval.requesterId}> has been approved: ${approval.approvalText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Request from <@${approval.requesterId}> has been *approved*:\n\n>${approval.approvalText}`
          }
        }
      ]
    });
  }
});

/**
 * Handles the reject button action
 * Updates the approval status and notifies the requester
 */
app.action('reject_request', async ({ ack, body, client }) => {
  await ack();
  const approvalId = body.actions[0].value;
  const approval = pendingApprovals.get(approvalId);

  if (approval) {
    approval.status = 'rejected';
    
    // Notify requester of rejection
    await client.chat.postMessage({
      channel: approval.requesterId,
      text: `Your request has been rejected by <@${body.user.id}>.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Your request has been rejected by <@${body.user.id}>.`
          }
        }
      ]
    });

    // Update original approval request message
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Request from <@${approval.requesterId}> has been rejected: ${approval.approvalText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Request from <@${approval.requesterId}> has been *rejected*:\n\n>${approval.approvalText}`
          }
        }
      ]
    });
  }
});

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log(`⚡️ Approval Bot is running on port ${process.env.PORT || 3000}!`);
})();