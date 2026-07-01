import type { Request, RequestHandler } from "express";

import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  recordSiteVisitor
} from "../services/metrics.js";

const normalizedRoute = (request: Request) => {
  const routePath = request.route?.path;

  if (typeof routePath === "string") {
    return `${request.baseUrl}${routePath === "/" ? "" : routePath}` || "/";
  }

  return request.baseUrl || "unmatched";
};

export const recordHttpMetrics: RequestHandler = (request, response, next) => {
  const endTimer = httpRequestDurationSeconds.startTimer();

  response.on("finish", () => {
    const labels = {
      method: request.method,
      route: normalizedRoute(request),
      status: String(response.statusCode)
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);

    if (response.statusCode < 400) {
      recordSiteVisitor(request);
    }
  });

  next();
};
