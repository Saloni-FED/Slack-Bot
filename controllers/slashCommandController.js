import { web } from "../slackClient.js"

export const slashCommandController = async (req, res) => {
  try {
    console.log("Slash command request body:", req.body)

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
}

