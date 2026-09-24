import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../middleware/error-handler.js";

describe("error handler logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps internal exception data out of both the response and logs", async () => {
    const sensitiveValues = [
      "db-password-super-secret",
      "oauth-access-token-super-secret",
      "private.person@example.test",
      "SELECT * FROM users WHERE email = 'private.person@example.test'"
    ];
    const error = Object.assign(new Error(sensitiveValues.join(" ")), {
      code: "oauth-access-token-super-secret"
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/private/:userId", (_request, _response, next) => next(error));
    app.use(errorHandler);

    const response = await request(app).get("/private/user-123?token=query-secret");
    const logged = log.mock.calls.map((call) => call.join(" ")).join(" ");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Une erreur interne est survenue."
      }
    });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      category: "internal_error",
      code: "INTERNAL_SERVER_ERROR",
      method: "GET",
      route: "/private/:userId",
      status: 500
    });
    for (const sensitiveValue of [...sensitiveValues, "user-123", "query-secret"]) {
      expect(response.text).not.toContain(sensitiveValue);
      expect(logged).not.toContain(sensitiveValue);
    }
  });
});
