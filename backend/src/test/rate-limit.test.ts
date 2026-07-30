import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { shouldSkipGlobalRateLimit } from "../middleware/rate-limit.js";

const requestWithPath = (path: string) =>
  ({
    path,
    headers: {},
    socket: {}
  }) as Request;

describe("rate limit middleware helpers", () => {
  it("skips health and character photo assets without skipping public API data", () => {
    expect(shouldSkipGlobalRateLimit(requestWithPath("/api/health"))).toBe(true);
    expect(shouldSkipGlobalRateLimit(requestWithPath("/uploads/characters/photo.webp"))).toBe(true);
    expect(shouldSkipGlobalRateLimit(requestWithPath("/api/graph"))).toBe(false);
  });
});
