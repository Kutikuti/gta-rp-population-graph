import type { SessionData } from "express-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSessionExpiry, SequelizeSessionStore } from "../services/session-store.js";

const baseSession = {
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    originalMaxAge: null
  }
} as unknown as SessionData;

describe("session store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("ignores an invalid string expiry", () => {
    const result = resolveSessionExpiry(
      {
        ...baseSession,
        cookie: { ...baseSession.cookie, expires: "invalid-date" as unknown as Date }
      },
      new Date("2026-06-27T10:00:00.000Z"),
      2
    );

    expect(result.toISOString()).toBe("2026-06-27T12:00:00.000Z");
  });

  it("reads active sessions and removes expired sessions", async () => {
    const activeRecord = {
      data: baseSession,
      expiresAt: new Date("2026-06-27T12:00:00.000Z"),
      destroy: vi.fn()
    };
    const expiredRecord = {
      data: baseSession,
      expiresAt: new Date("2026-06-27T09:00:00.000Z"),
      destroy: vi.fn()
    };
    const model = createSessionModel();
    model.findByPk
      .mockResolvedValueOnce(activeRecord)
      .mockResolvedValueOnce(expiredRecord)
      .mockResolvedValueOnce(null);
    const store = createStore(model);
    vi.setSystemTime(new Date("2026-06-27T10:00:00.000Z"));

    const activeCallback = vi.fn();
    await store.get("active", activeCallback);
    expect(activeCallback).toHaveBeenCalledWith(undefined, baseSession);

    const expiredCallback = vi.fn();
    await store.get("expired", expiredCallback);
    expect(expiredRecord.destroy).toHaveBeenCalledOnce();
    expect(expiredCallback).toHaveBeenCalledWith(undefined, null);

    const missingCallback = vi.fn();
    await store.get("missing", missingCallback);
    expect(missingCallback).toHaveBeenCalledWith(undefined, null);
  });

  it("persists, refreshes and destroys sessions", async () => {
    const model = createSessionModel();
    const store = createStore(model);
    vi.setSystemTime(new Date("2026-06-27T10:00:00.000Z"));

    const setCallback = vi.fn();
    await store.set("session-id", baseSession, setCallback);
    expect(model.upsert).toHaveBeenCalledWith({
      sid: "session-id",
      data: baseSession,
      expiresAt: new Date("2026-06-28T10:00:00.000Z")
    });
    expect(setCallback).toHaveBeenCalledWith();

    const touchCallback = vi.fn();
    await store.touch("session-id", baseSession, touchCallback);
    expect(model.update).toHaveBeenCalledWith(
      { expiresAt: new Date("2026-06-28T10:00:00.000Z") },
      { where: { sid: "session-id" } }
    );
    expect(touchCallback).toHaveBeenCalledOnce();

    const destroyCallback = vi.fn();
    await store.destroy("session-id", destroyCallback);
    expect(model.destroy).toHaveBeenCalledWith({ where: { sid: "session-id" } });
    expect(destroyCallback).toHaveBeenCalledWith();
  });

  it("forwards storage errors through callbacks", async () => {
    const error = new Error("database unavailable");
    const model = createSessionModel();
    model.findByPk.mockRejectedValue(error);
    model.upsert.mockRejectedValue(error);
    model.destroy.mockRejectedValue(error);
    model.update.mockRejectedValue(error);
    const store = createStore(model);

    const getCallback = vi.fn();
    await store.get("session-id", getCallback);
    expect(getCallback).toHaveBeenCalledWith(error);

    const setCallback = vi.fn();
    await store.set("session-id", baseSession, setCallback);
    expect(setCallback).toHaveBeenCalledWith(error);

    const destroyCallback = vi.fn();
    await store.destroy("session-id", destroyCallback);
    expect(destroyCallback).toHaveBeenCalledWith(error);

    const touchCallback = vi.fn();
    await store.touch("session-id", baseSession, touchCallback);
    expect(touchCallback).toHaveBeenCalledOnce();
  });

  it("cleans expired sessions manually and on schedule", async () => {
    const model = createSessionModel();
    const store = createStore(model);
    const referenceDate = new Date("2026-06-27T10:00:00.000Z");

    await store.cleanupExpiredSessions(referenceDate);
    expect(model.destroy).toHaveBeenCalledWith({
      where: { expiresAt: expect.any(Object) }
    });

    model.destroy.mockClear();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(model.destroy).toHaveBeenCalledOnce();
  });
});

const createSessionModel = () => ({
  findByPk: vi.fn(),
  upsert: vi.fn(),
  destroy: vi.fn(),
  update: vi.fn()
});

const createStore = (model: ReturnType<typeof createSessionModel>) =>
  new SequelizeSessionStore(model as never, { ttlHours: 24, cleanupIntervalMinutes: 5 });
