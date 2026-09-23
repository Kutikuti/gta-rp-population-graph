import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";

describe("GET /api/health", () => {
  it("returns the API health status", async () => {
    const response = await request(createApp({ databaseHealthCheck: async () => {} })).get(
      "/api/health"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "gta-rp-population-graph-api"
    });
  });

  it("does not rate limit loopback requests in non-production environments", async () => {
    const app = createApp({ databaseHealthCheck: async () => {} });

    for (let index = 0; index < 105; index += 1) {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
    }
  });

  it("returns 503 without database details when the probe fails", async () => {
    const response = await request(
      createApp({
        databaseHealthCheck: async () => {
          throw new Error("database credentials must not leak");
        }
      })
    ).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });

  it("returns 503 when the database probe exceeds its deadline", async () => {
    const response = await request(
      createApp({
        databaseHealthCheck: () => new Promise<void>(() => {}),
        healthCheckTimeoutMs: 5
      })
    ).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });
});
