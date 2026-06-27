import type { SessionData } from "express-session";
import { describe, expect, it } from "vitest";

import { resolveSessionExpiry } from "../services/session-store.js";

const baseSession = {
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    originalMaxAge: null
  }
} as unknown as SessionData;

describe("session store", () => {
  it("uses cookie.expires when available", () => {
    const expires = new Date("2026-06-27T12:00:00.000Z");
    const result = resolveSessionExpiry(
      {
        ...baseSession,
        cookie: {
          ...baseSession.cookie,
          expires
        }
      },
      new Date("2026-06-27T10:00:00.000Z"),
      24
    );

    expect(result.toISOString()).toBe("2026-06-27T12:00:00.000Z");
  });

  it("falls back to cookie.maxAge when expires is absent", () => {
    const result = resolveSessionExpiry(
      {
        ...baseSession,
        cookie: {
          ...baseSession.cookie,
          maxAge: 30 * 60 * 1000
        }
      },
      new Date("2026-06-27T10:00:00.000Z"),
      24
    );

    expect(result.toISOString()).toBe("2026-06-27T10:30:00.000Z");
  });

  it("falls back to the configured TTL when the cookie has no explicit expiry", () => {
    const result = resolveSessionExpiry(baseSession, new Date("2026-06-27T10:00:00.000Z"), 24);

    expect(result.toISOString()).toBe("2026-06-28T10:00:00.000Z");
  });
});
