import express from "express"
import dotenv from "dotenv"
import { createEventAdapter } from "@slack/events-api"
import { slashCommandController } from "./controllers/slashCommandController.js"
import { interactionController } from "./controllers/interactionController.js"
import { healthCheckController } from "./controllers/healthCheckController.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Initialize a Slack Events API adapter
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET)

// IMPORTANT: Mount the event adapter middleware first
app.use("/slack/events", slackEvents.requestListener())

// Then add other middleware
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Routes
app.post("/slack/commands/approval-test", slashCommandController)
app.post("/slack/interactions", interactionController)
app.get("/health", healthCheckController)

// Start the server
app.listen(port, () => {
  console.log(`⚡️ Slack bot is running on port ${port}`)
})

// Handle errors
slackEvents.on("error", console.error)

export default app

