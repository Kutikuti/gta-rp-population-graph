import type express from "express";
import { Router } from "express";

import { env } from "../config/env.js";
import { destroySession, regenerateSession, requireAuthenticatedUser } from "../middleware/auth.js";
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

const clearOauthSessionState = (request: express.Request) => {
  request.session.oauthState = undefined;
  request.session.oauthIntent = undefined;
  request.session.oauthLinkUserId = undefined;
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
      request.session.oauthIntent = "login";
      request.session.oauthLinkUserId = undefined;
      response.redirect(302, googleOauthClient.buildAuthorizationUrl(state));
    } catch (error) {
      if (error instanceof GoogleOauthDisabledError) {
        response.redirect(302, redirectToClient({ auth_error: "oauth_disabled" }));
        return;
      }

      next(error);
    }
  });

  router.get("/google/link", requireAuthenticatedUser, async (request, response, next) => {
    try {
      if (!request.currentUser) {
        throw new Error("Authenticated route reached without current user.");
      }

      const state = createOauthState();
      request.session.oauthState = state;
      request.session.oauthIntent = "link_google";
      request.session.oauthLinkUserId = request.currentUser.id;
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

      const oauthIntent = request.session.oauthIntent ?? "login";
      const oauthLinkUserId = request.session.oauthLinkUserId;
      clearOauthSessionState(request);

      const profile = await googleOauthClient.exchangeCodeForProfile(code);

      if (oauthIntent === "link_google") {
        if (
          !oauthLinkUserId ||
          !request.session.userId ||
          request.session.userId !== oauthLinkUserId
        ) {
          throw new GoogleOauthStateError(
            "Google link callback state did not match the active session."
          );
        }

        const result = await authService.linkGoogleIdentity(oauthLinkUserId, profile);

        if (!result) {
          response.redirect(302, redirectToClient({ auth_error: "identity_link_failed" }));
          return;
        }

        if (result.status === "linked_to_other_user") {
          response.redirect(302, redirectToClient({ auth_error: "identity_in_use" }));
          return;
        }

        request.session.userId = result.user.id;
        response.redirect(
          302,
          redirectToClient({
            auth: result.status === "linked" ? "identity_linked" : "identity_already_linked"
          })
        );
        return;
      }

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
