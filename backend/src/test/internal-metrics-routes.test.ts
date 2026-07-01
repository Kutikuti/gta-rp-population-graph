import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { MetricsService } from "../services/metrics.js";

class FixtureMetricsService implements MetricsService {
  readonly contentType = "text/plain; version=0.0.4; charset=utf-8";

  async renderMetrics() {
    return [
      "# HELP gta_rp_characters_published Nombre de fiches personnage publiees.",
      "# TYPE gta_rp_characters_published gauge",
      "gta_rp_characters_published 42"
    ].join("\n");
  }
}

describe("internal metrics routes", () => {
  it("rejects requests without metrics token", async () => {
    const app = createApp({
      metricsService: new FixtureMetricsService()
    });

    const response = await request(app).get("/api/internal/metrics");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects requests with an invalid metrics token", async () => {
    const app = createApp({
      metricsService: new FixtureMetricsService()
    });

    const response = await request(app)
      .get("/api/internal/metrics")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns Prometheus metrics with a valid metrics token", async () => {
    const app = createApp({
      metricsService: new FixtureMetricsService()
    });

    const response = await request(app)
      .get("/api/internal/metrics")
      .set("Authorization", `Bearer ${process.env.METRICS_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.type).toBe("text/plain");
    expect(response.text).toContain("gta_rp_characters_published 42");
  });
});
