import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import {
  createRequestRateLimits,
  type RequestRateLimits
} from "../middleware/request-rate-limits.js";

const limits: RequestRateLimits = {
  readMax: 2,
  sensitiveMax: 2,
  sessionMax: 2,
  windowMs: 15_000,
  sessionWindowMs: 1_000
};

const fixture = () => {
  const app = express();
  // Supertest is the trusted loopback proxy for these synthetic clients.
  app.set("trust proxy", "loopback");
  app.use(createRequestRateLimits(limits));
  app.use((_request, response) => response.json({ ok: true }));
  return app;
};

describe("independent request budgets", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("limits public reads without consuming login, logout or session checks", async () => {
    const app = fixture();
    await request(app).get("/api/graph").expect(200);
    await request(app).get("/api/tags").expect(200);
    const blocked = await request(app).get("/api/graph").expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    await request(app).get("/api/auth/google").expect(200);
    await request(app).post("/api/auth/logout").expect(200);
    await request(app).get("/api/auth/session").expect(200);
    await request(app).get("/api/auth/session").expect(429);
  });

  it("retains a bounded budget for OAuth and all writes", async () => {
    const app = fixture();
    await request(app).get("/api/auth/google").expect(200);
    await request(app).post("/api/contributions/change-requests").expect(200);
    await request(app).get("/api/auth/twitch/callback").expect(429);
    await request(app).post("/api/admin/users/fixture/ban").expect(429);
    await request(app).get("/api/tags").expect(200);
    await request(app).post("/api/auth/logout").expect(200);
  });

  it("does not misclassify case, slash or HEAD aliases of OAuth routes", async () => {
    const app = fixture();
    await request(app).get("/API/AUTH/GOOGLE/").expect(200);
    await request(app).head("/api/auth/discord/callback/").expect(200);
    await request(app).get("/api/auth/google/link").expect(429);
    await request(app).get("/api/graph").expect(200);
  });

  it("uses the short control budget for session and logout aliases", async () => {
    const app = fixture();
    await request(app).head("/API/AUTH/SESSION/").expect(200);
    await request(app).post("/API/AUTH/LOGOUT/").expect(200);
    await request(app).get("/api/auth/session").expect(429);
    await request(app).get("/api/auth/google").expect(200);
  });

  it("keeps distinct client IP budgets behind the trusted proxy", async () => {
    const app = fixture();
    for (let i = 0; i < 2; i++) {
      await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.10").expect(200);
    }
    await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.10").expect(429);
    await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.11").expect(200);
  });

  it("preserves IPv6 subnet grouping against address rotation", async () => {
    const app = fixture();
    await request(app).get("/api/graph").set("X-Forwarded-For", "2001:db8:1:1::1").expect(200);
    await request(app).get("/api/graph").set("X-Forwarded-For", "2001:db8:1:2::2").expect(200);
    await request(app).get("/api/graph").set("X-Forwarded-For", "2001:db8:1:3::3").expect(429);
    await request(app).get("/api/graph").set("X-Forwarded-For", "2001:db8:2::1").expect(200);
  });

  it("does not trust forged forwarding headers without a trusted proxy", async () => {
    const app = fixture();
    app.set("trust proxy", false);
    await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.20").expect(200);
    await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.21").expect(200);
    await request(app).get("/api/graph").set("X-Forwarded-For", "192.0.2.22").expect(429);
  });

  it("recovers after the short session window without resetting the read window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = fixture();
    await request(app).get("/api/graph").expect(200);
    await request(app).get("/api/graph").expect(200);
    await request(app).get("/api/auth/session").expect(200);
    await request(app).get("/api/auth/session").expect(200);
    await request(app).get("/api/auth/session").expect(429);
    vi.setSystemTime(Date.now() + limits.sessionWindowMs + 1);
    await request(app).get("/api/auth/session").expect(200);
    await request(app).get("/api/graph").expect(429);
    vi.setSystemTime(Date.now() + limits.windowMs + 1);
    await request(app).get("/api/graph").expect(200);
  });

  it("keeps health, character assets and supervision authorization independent of exhausted budgets", async () => {
    const app = fixture();
    await request(app).get("/api/graph").expect(200);
    await request(app).get("/api/graph").expect(200);
    await request(app).get("/api/graph").expect(429);
    for (const path of [
      "/api/health",
      "/uploads/characters/fixture.webp",
      "/api/supervision/authorize"
    ]) {
      const response = await request(app).get(path).expect(200);
      expect(response.headers["ratelimit-limit"]).toBeUndefined();
    }
  });

  it("wires real application routes to their configured budgets", async () => {
    const app = createApp({ databaseHealthCheck: async () => {} });
    const read = await request(app).get("/api/profile").expect(401);
    const control = await request(app).get("/api/auth/session").expect(200);
    const write = await request(app)
      .patch("/api/profile/display-name")
      .send({ displayName: "Fixture" })
      .expect(401);
    expect(read.headers["ratelimit-limit"]).toBe(String(env.RATE_LIMIT_READ_MAX_REQUESTS));
    expect(control.headers["ratelimit-limit"]).toBe(String(env.RATE_LIMIT_SESSION_MAX_REQUESTS));
    expect(control.headers["ratelimit-policy"]).toBe(
      `${env.RATE_LIMIT_SESSION_MAX_REQUESTS};w=${env.RATE_LIMIT_SESSION_WINDOW_MS / 1000}`
    );
    expect(write.headers["ratelimit-limit"]).toBe(String(env.RATE_LIMIT_MAX_REQUESTS));
    await request(app).get("/api/health").expect(200);
  });
});
