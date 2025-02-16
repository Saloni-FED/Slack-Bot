import { web } from "../slackClient.js"

// Store pending approvals (in-memory storage - consider using a database for production)
const pendingApprovals = new Map()


// Code for modal interaction
export const interactionController = async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload)
    console.log("Interaction payload:", payload)

    if (payload.type === "view_submission" && payload.view.callback_id === "approval_modal") {
      await handleModalSubmission(payload, res)
    } else if (payload.type === "block_actions") {
      await handleButtonClick(payload, res)
    }
  } catch (error) {
    console.error("Error processing interaction:", error)
    res.status(500).send("Failed to process interaction")
  }
}


// Modal submission code where user will submit the modal after choosing Approver and Writing Description

async function handleModalSubmission(payload, res) {
  const approver = payload.view.state.values.approver_block.approver_select.selected_option.value
  const approvalText = payload.view.state.values.approval_text_block.approval_text_input.value
  const requesterId = payload.user.id
  const approvalId = `approval_${Date.now()}`

  pendingApprovals.set(approvalId, {
    requesterId,
    approver,
    approvalText,
    status: "pending",
  })

  try {
    await web.chat.postMessage({
      channel: requesterId,
      text: `Your approval request has been sent to <@${approver}>.`,
    });
    await web.chat.postMessage({
      channel: approver,
      text: `New approval request from <@${requesterId}>: ${approvalText}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `You have a new approval request from <@${requesterId}>:\n\n>${approvalText}`,
          },
        },
        {
          type: "actions",
          block_id: "approval_actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Approve",
              },
              style: "primary",
              value: approvalId,
              action_id: "approve_request",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Reject",
              },
              style: "danger",
              value: approvalId,
              action_id: "reject_request",
            },
          ],
        },
      ],
    })

    res.status(200).send("")
  } catch (error) {
    console.error("Error sending approval request:", error)
    res.status(500).send("Failed to send approval request")
  }
}


// This is the code when approver will select wether it is Rejected or approved

async function handleButtonClick(payload, res) {
  const action = payload.actions[0]
  const approvalId = action.value
  const approval = pendingApprovals.get(approvalId)

  if (approval) {
    const isApproved = action.action_id === "approve_request"
    approval.status = isApproved ? "approved" : "rejected"

    try {
      await notifyRequester(approval, isApproved, payload.user.id)
      await updateOriginalMessage(payload, approval, isApproved)

      res.status(200).send("")
    } catch (error) {
      console.error("Error handling approval action:", error)
      res.status(500).send("Failed to process approval action")
    }
  } else {
    res.status(404).send("Approval request not found")
  }
}


// This is the code after approver will select button approve or reject , a notification will send to requester
async function notifyRequester(approval, isApproved, approverId) {
  await web.chat.postMessage({
    channel: approval.requesterId,
    text: `Your request has been ${isApproved ? "approved" : "rejected"} by <@${approverId}>.`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Your request has been ${isApproved ? "approved" : "rejected"} by <@${approverId}>.`,
        },
      },
    ],
  })
}

async function updateOriginalMessage(payload, approval, isApproved) {
  await web.chat.update({
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: `Request ${isApproved ? "approved" : "rejected"}: ${approval.approvalText}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Request from <@${approval.requesterId}> has been *${isApproved ? "approved" : "rejected"}*:\n\n>${approval.approvalText}`,
        },
      },
    ],
  })
}

