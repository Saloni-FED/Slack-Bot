// import request from "supertest";
// import app from "../app"; // Ensure this correctly imports your Express app

import request from "supertest";
import app from "../app";
// import { web } from "../slackClient"; // Mock the Slack WebClient instance
import { jest } from "@jest/globals";

jest.mock("../slackClient", () => ({
  web: {
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ok: true }),
      update: jest.fn().mockResolvedValue({ ok: true }),
    },
  },
}));

describe("POST /slack/interactions", () => {
  it("should return 500 for invalid JSON payload", async () => {
    const response = await request(app)
      .post("/slack/interactions")
      .send("invalid_payload")
      .set("Content-Type", "application/x-www-form-urlencoded");

    expect(response.status).toBe(500);
  });
});

describe("GET /health", () => {
  it("should return 200 OK", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });

  it("should return a valid response type", async () => {
    const response = await request(app).get("/health");
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });
});

