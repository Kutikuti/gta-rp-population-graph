import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { createPublicRouter } from "./routes/public.js";
import type { PublicDataService } from "./services/public-data.js";

export type AppDependencies = {
  publicDataService?: PublicDataService;
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_CLIENT_URL,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);
  app.use("/api", createPublicRouter(dependencies.publicDataService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
