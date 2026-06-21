import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { env } from "./config/env.js";
import { loadCurrentUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminRouter } from "./routes/admin.js";
import { createAuthRouter, sessionMiddleware } from "./routes/auth.js";
import { createContributionsRouter } from "./routes/contributions.js";
import { healthRouter } from "./routes/health.js";
import { createModerationRouter } from "./routes/moderation.js";
import { createProfileRouter } from "./routes/profile.js";
import { createPublicRouter } from "./routes/public/index.js";
import { type AuthService, SequelizeAuthService } from "./services/auth.js";
import {
  type ChangeRequestService,
  SequelizeChangeRequestService
} from "./services/change-requests.js";
import { characterPhotoPublicDir } from "./services/character-photos.js";
import { type GoogleOauthClient, GoogleOidcClient } from "./services/google-oauth.js";
import type { PublicDataService } from "./services/public-data.js";

export type AppDependencies = {
  publicDataService?: PublicDataService;
  authService?: AuthService;
  googleOauthClient?: GoogleOauthClient;
  changeRequestService?: ChangeRequestService;
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const authService = dependencies.authService ?? new SequelizeAuthService();
  const googleOauthClient = dependencies.googleOauthClient ?? new GoogleOidcClient();
  const changeRequestService =
    dependencies.changeRequestService ?? new SequelizeChangeRequestService();
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
  app.use(
    "/uploads/characters",
    express.static(characterPhotoPublicDir, {
      fallthrough: false,
      immutable: true,
      maxAge: "30d",
      setHeaders: (response) => {
        response.setHeader("Access-Control-Allow-Origin", env.WEB_CLIENT_URL);
        response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);
  app.use(loadCurrentUser(authService));

  app.use("/api/health", healthRouter);
  app.use(
    "/api/auth",
    createAuthRouter({
      authService,
      googleOauthClient
    })
  );
  app.use("/api/contributions", createContributionsRouter(changeRequestService));
  app.use("/api/moderation", createModerationRouter(changeRequestService));
  app.use("/api/profile", createProfileRouter(authService));
  app.use("/api/admin", adminRouter);
  app.use("/api", createPublicRouter(dependencies.publicDataService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
