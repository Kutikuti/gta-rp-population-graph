import type express from "express";
import { Router } from "express";
import session from "express-session";

import { env } from "../config/env.js";
import { destroySession, regenerateSession } from "../middleware/auth.js";
import type { AuthService } from "../services/auth.js";
import {
  createOauthState,
  type GoogleOauthClient,
  GoogleOauthDisabledError,
  GoogleOauthExchangeError,
  GoogleOauthStateError
} from "../services/google-oauth.js";

export type AuthRouterDependencies = {
  authService: AuthService;
  googleOauthClient: GoogleOauthClient;
};

export const sessionMiddleware = session({
  secret: env.SESSION_SECRET,
  name: env.SESSION_COOKIE_NAME,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: env.SESSION_COOKIE_SAME_SITE,
    secure: env.NODE_ENV === "production" && env.SESSION_COOKIE_SECURE
  }
});

const sessionPayload = (request: express.Request) =>
  request.currentUser
    ? {
        authenticated: true,
        user: request.currentUser
      }
    : {
        authenticated: false
      };

const redirectToClient = (searchParams: Record<string, string>) => {
  const url = new URL(env.WEB_CLIENT_URL);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

export const createAuthRouter = ({ authService, googleOauthClient }: AuthRouterDependencies) => {
  const router = Router();

  router.get("/session", (request, response) => {
    response.json(sessionPayload(request));
  });

  router.get("/google", async (request, response, next) => {
    try {
      const state = createOauthState();
      await regenerateSession(request);
      request.session.oauthState = state;
      response.redirect(302, googleOauthClient.buildAuthorizationUrl(state));
    } catch (error) {
      if (error instanceof GoogleOauthDisabledError) {
        response.redirect(302, redirectToClient({ auth_error: "oauth_disabled" }));
        return;
      }

      next(error);
    }
  });

  router.get("/google/callback", async (request, response, next) => {
    try {
      const { code, state, error } = request.query;

      if (typeof error === "string") {
        response.redirect(302, redirectToClient({ auth_error: error }));
        return;
      }

      if (typeof code !== "string" || typeof state !== "string") {
        throw new GoogleOauthStateError("Google callback is missing code or state.");
      }

      if (!request.session.oauthState || request.session.oauthState !== state) {
        throw new GoogleOauthStateError("Google callback state did not match the session.");
      }

      request.session.oauthState = undefined;

      const profile = await googleOauthClient.exchangeCodeForProfile(code);
      const result = await authService.authenticateGoogleIdentity(profile);

      if (result.status === "banned") {
        await destroySession(request);
        response.clearCookie(env.SESSION_COOKIE_NAME);
        response.redirect(302, redirectToClient({ auth_error: "banned" }));
        return;
      }

      await regenerateSession(request);
      request.session.userId = result.user.id;
      response.redirect(302, redirectToClient({ auth: "success" }));
    } catch (error) {
      if (
        error instanceof GoogleOauthDisabledError ||
        error instanceof GoogleOauthExchangeError ||
        error instanceof GoogleOauthStateError
      ) {
        response.redirect(
          302,
          redirectToClient({
            auth_error:
              error instanceof GoogleOauthDisabledError
                ? "oauth_disabled"
                : error instanceof GoogleOauthStateError
                  ? "invalid_state"
                  : "oauth_exchange_failed"
          })
        );
        return;
      }

      next(error);
    }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      await destroySession(request);
      response.clearCookie(env.SESSION_COOKIE_NAME);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
};
