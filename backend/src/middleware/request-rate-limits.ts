import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../config/env.js";
import { shouldSkipGlobalRateLimit } from "./rate-limit.js";

type Budget = "read" | "sensitive" | "session";

export type RequestRateLimits = {
  readMax: number;
  sensitiveMax: number;
  sessionMax: number;
  windowMs: number;
  sessionWindowMs: number;
};

const budgetFor = (request: Request): Budget => {
  // Express routes are case insensitive and accept a trailing slash by default.
  // Those aliases must not turn OAuth callbacks into ordinary read requests.
  const path = request.path.toLowerCase().replace(/\/+$/u, "");
  const reading = request.method === "GET" || request.method === "HEAD";

  if (
    (reading && path === "/api/auth/session") ||
    (request.method === "POST" && path === "/api/auth/logout")
  ) {
    return "session";
  }

  if (reading && path !== "/api/auth" && !path.startsWith("/api/auth/")) {
    return "read";
  }

  return "sensitive";
};

export const createRequestRateLimits = (
  limits: RequestRateLimits = {
    readMax: env.RATE_LIMIT_READ_MAX_REQUESTS,
    sensitiveMax: env.RATE_LIMIT_MAX_REQUESTS,
    sessionMax: env.RATE_LIMIT_SESSION_MAX_REQUESTS,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    sessionWindowMs: env.RATE_LIMIT_SESSION_WINDOW_MS
  }
): RequestHandler => {
  const limiter = (limit: number, windowMs: number) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Trop de requêtes. Patientez avant de réessayer."
        }
      },
      skip: (request) =>
        shouldSkipGlobalRateLimit(request) ||
        (request.method === "GET" && request.path === "/api/supervision/authorize")
    });

  // Each budget retains the library's IP/IPv6 keying and owns its own store.
  const budgets = {
    read: limiter(limits.readMax, limits.windowMs),
    sensitive: limiter(limits.sensitiveMax, limits.windowMs),
    session: limiter(limits.sessionMax, limits.sessionWindowMs)
  };

  return (request, response, next) => budgets[budgetFor(request)](request, response, next);
};
