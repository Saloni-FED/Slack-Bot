// const express = require("express")
// const { WebClient } = require("@slack/web-api")
// const { createEventAdapter } = require("@slack/events-api")
// require("dotenv").config()

import express from "express"
import { WebClient } from "@slack/web-api"
import { createEventAdapter } from "@slack/events-api"
import dotenv from "dotenv";
dotenv.config();


const app = express()
const port = process.env.PORT || 3000

// Initialize Slack Web Client
const web = new WebClient(process.env.SLACK_BOT_TOKEN)

// Initialize a Slack Events API adapter
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET)

// IMPORTANT: Mount the event adapter middleware first
app.use("/slack/events", slackEvents.requestListener())

// Then add other middleware
// Use urlencoded for slash commands
app.use(express.urlencoded({ extended: true }))
// Use json parser for interactions
app.use(express.json())

// Store pending approvals (in-memory storage - consider using a database for production)
const pendingApprovals = new Map()

// Handle slash command
app.post("/slack/commands/approval-test", async (req, res) => {
  try {
    // Log the request body to debug
    console.log("Slash command request body:", req.body)

    // Verify we have a trigger_id
    if (!req.body.trigger_id) {
      console.error("No trigger_id found in request body")
      return res.status(400).send("Invalid request: No trigger_id found")
    }

    const result = await web.users.list()
    const users = result.members
      .filter((user) => !user.is_bot && user.id !== "USLACKBOT")
      .map((user) => ({
        text: {
          type: "plain_text",
          text: user.real_name || user.name,
        },
        value: user.id,
      }))

    await web.views.open({
      trigger_id: req.body.trigger_id,
      view: {
        type: "modal",
        callback_id: "approval_modal",
        title: {
          type: "plain_text",
          text: "Request Approval",
        },
        blocks: [
          {
            type: "input",
            block_id: "approver_block",
            label: {
              type: "plain_text",
              text: "Select Approver",
            },
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select an approver",
              },
              options: users,
              action_id: "approver_select",
            },
          },
          {
            type: "input",
            block_id: "approval_text_block",
            label: {
              type: "plain_text",
              text: "Approval Request Details",
            },
            element: {
              type: "plain_text_input",
              multiline: true,
              action_id: "approval_text_input",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    })

    res.status(200).send("Request sent successfully")
  } catch (error) {
    console.error("Error handling slash command:", error)
    res.status(500).send("Failed to handle command")
  }
})

// Handle interactive components (modal submissions and button clicks)
app.post("/slack/interactions", async (req, res) => {
  try {
    // For interactions endpoint, the payload comes as a string that needs to be parsed
    const payload = JSON.parse(req.body.payload)
    console.log("Interaction payload:", payload)

    if (payload.type === "view_submission" && payload.view.callback_id === "approval_modal") {
      // Handle modal submission
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
    } else if (payload.type === "block_actions") {
      // Handle button clicks
      const action = payload.actions[0]
      const approvalId = action.value
      const approval = pendingApprovals.get(approvalId)

      if (approval) {
        const isApproved = action.action_id === "approve_request"
        approval.status = isApproved ? "approved" : "rejected"

        try {
          // Notify requester
          await web.chat.postMessage({
            channel: approval.requesterId,
            text: `Your request has been ${isApproved ? "approved" : "rejected"} by <@${payload.user.id}>.`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `Your request has been ${isApproved ? "approved" : "rejected"} by <@${payload.user.id}>.`,
                },
              },
            ],
          })

          // Update original message
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

          res.status(200).send("")
        } catch (error) {
          // console.error("Error handling approval action:", error)
          res.status(500).send("Failed to process approval action")
        }
      } else {
        res.status(404).send("Approval request not found")
      }
    }
  } catch (error) {
    console.error("Error processing interaction:", error)
    res.status(500).send("Failed to process interaction")
  }
})

// Add a basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK")
})

// Start the server
app.listen(port, () => {
  console.log(`⚡️ Slack bot is running on port ${port}`)
})

// Handle errors
slackEvents.on("error", console.error)

export default app;