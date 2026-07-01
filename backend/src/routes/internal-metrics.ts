import { Router } from "express";

import { env } from "../config/env.js";
import { type MetricsService, PrometheusMetricsService } from "../services/metrics.js";

export const createInternalMetricsRouter = (
  metricsService: MetricsService = new PrometheusMetricsService()
) => {
  const router = Router();

  router.get("/metrics", async (request, response, next) => {
    try {
      const authorization = request.header("authorization");
      const expectedAuthorization = env.METRICS_TOKEN ? `Bearer ${env.METRICS_TOKEN}` : null;

      if (!expectedAuthorization) {
        response.status(503).json({
          error: {
            code: "METRICS_DISABLED",
            message: "Les metriques internes ne sont pas configurees."
          }
        });
        return;
      }

      if (authorization !== expectedAuthorization) {
        response.status(401).json({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Token de metriques requis."
          }
        });
        return;
      }

      response.type(metricsService.contentType);
      response.send(await metricsService.renderMetrics());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
