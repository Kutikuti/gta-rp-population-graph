import type express from "express";
import { Router } from "express";

import { env } from "../config/env.js";
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
  requireAuthenticatedUser
} from "../middleware/auth.js";
import type { AuthService, ExternalIdentity } from "../services/auth.js";
import {
  type DiscordOauthClient,
  DiscordOauthDisabledError,
  DiscordOauthExchangeError
} from "../services/discord-oauth.js";
import {
  createOauthState,
  type GoogleOauthClient,
  GoogleOauthDisabledError,
  GoogleOauthExchangeError,
  GoogleOauthStateError
} from "../services/google-oauth.js";
import {
  type TwitchOauthClient,
  TwitchOauthDisabledError,
  TwitchOauthExchangeError
} from "../services/twitch-oauth.js";

export type AuthRouterDependencies = {
  authService: AuthService;
  googleOauthClient: GoogleOauthClient;
  discordOauthClient: DiscordOauthClient;
  twitchOauthClient: TwitchOauthClient;
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
  delete request.session.oauthState;
  delete request.session.oauthIntent;
  delete request.session.oauthLinkUserId;
};

type OauthClient = {
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<ExternalIdentity>;
};

type OauthLinkIntent = "link_google" | "link_discord" | "link_twitch";

const oauthErrorCode = (error: unknown) => {
  if (
    error instanceof GoogleOauthDisabledError ||
    error instanceof DiscordOauthDisabledError ||
    error instanceof TwitchOauthDisabledError
  ) {
    return "oauth_disabled";
  }

  if (error instanceof GoogleOauthStateError) {
    return "invalid_state";
  }

  if (
    error instanceof GoogleOauthExchangeError ||
    error instanceof DiscordOauthExchangeError ||
    error instanceof TwitchOauthExchangeError
  ) {
    return "oauth_exchange_failed";
  }

  return null;
};

export const createAuthRouter = ({
  authService,
  googleOauthClient,
  discordOauthClient,
  twitchOauthClient
}: AuthRouterDependencies) => {
  const router = Router();

  const withOauthRedirect =
    (
      handler: (request: express.Request, response: express.Response) => Promise<void> | void
    ): express.RequestHandler =>
    async (request, response, next) => {
      try {
        await handler(request, response);
      } catch (error) {
        const errorCode = oauthErrorCode(error);

        if (errorCode) {
          response.redirect(302, redirectToClient({ auth_error: errorCode }));
          return;
        }

        next(error);
      }
    };

  const startOauthLogin = async (
    request: express.Request,
    response: express.Response,
    client: OauthClient
  ) => {
    const state = createOauthState();
    await regenerateSession(request);
    request.session.oauthState = state;
    request.session.oauthIntent = "login";
    delete request.session.oauthLinkUserId;
    response.redirect(302, client.buildAuthorizationUrl(state));
  };

  const startOauthLink = (
    request: express.Request,
    response: express.Response,
    client: OauthClient,
    intent: OauthLinkIntent
  ) => {
    if (!request.currentUser) {
      throw new Error("Authenticated route reached without current user.");
    }

    const state = createOauthState();
    request.session.oauthState = state;
    request.session.oauthIntent = intent;
    request.session.oauthLinkUserId = request.currentUser.id;
    response.redirect(302, client.buildAuthorizationUrl(state));
  };

  const handleOauthCallback = async (
    request: express.Request,
    response: express.Response,
    client: OauthClient,
    linkIntent: OauthLinkIntent
  ) => {
    const { code, state, error } = request.query;

    if (typeof error === "string") {
      response.redirect(302, redirectToClient({ auth_error: error }));
      return;
    }

    if (typeof code !== "string" || typeof state !== "string") {
      throw new GoogleOauthStateError("OAuth callback is missing code or state.");
    }

    if (!request.session.oauthState || request.session.oauthState !== state) {
      throw new GoogleOauthStateError("OAuth callback state did not match the session.");
    }

    const oauthIntent = request.session.oauthIntent ?? "login";
    const oauthLinkUserId = request.session.oauthLinkUserId;
    clearOauthSessionState(request);

    const profile = await client.exchangeCodeForProfile(code);

    if (oauthIntent === linkIntent) {
      if (
        !oauthLinkUserId ||
        !request.session.userId ||
        request.session.userId !== oauthLinkUserId
      ) {
        throw new GoogleOauthStateError(
          "OAuth link callback state did not match the active session."
        );
      }

      const result = await authService.linkIdentity(oauthLinkUserId, profile);

      if (!result) {
        response.redirect(302, redirectToClient({ auth_error: "identity_link_failed" }));
        return;
      }

      if (result.status === "linked_to_other_user") {
        response.redirect(302, redirectToClient({ auth_error: "identity_in_use" }));
        return;
      }

      if (result.status === "different_identity_already_linked") {
        response.redirect(
          302,
          redirectToClient({ auth_error: "different_identity_already_linked" })
        );
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

    if (oauthIntent !== "login") {
      throw new GoogleOauthStateError("OAuth callback intent did not match the callback provider.");
    }

    const result = await authService.authenticateIdentity(profile);

    if (result.status === "banned") {
      await destroySession(request);
      clearSessionCookie(response);
      response.redirect(302, redirectToClient({ auth_error: "banned" }));
      return;
    }

    if (result.status === "email_in_use") {
      response.redirect(302, redirectToClient({ auth_error: "identity_email_in_use" }));
      return;
    }

    await regenerateSession(request);
    request.session.userId = result.user.id;
    response.redirect(302, redirectToClient({ auth: "success" }));
  };

  const registerOauthProvider = ({
    path,
    client,
    linkIntent
  }: {
    path: string;
    client: OauthClient;
    linkIntent: OauthLinkIntent;
  }) => {
    router.get(
      `/${path}`,
      withOauthRedirect((request, response) => startOauthLogin(request, response, client))
    );

    router.get(
      `/${path}/link`,
      requireAuthenticatedUser,
      withOauthRedirect((request, response) =>
        startOauthLink(request, response, client, linkIntent)
      )
    );

    router.get(
      `/${path}/callback`,
      withOauthRedirect((request, response) =>
        handleOauthCallback(request, response, client, linkIntent)
      )
    );
  };

  router.get("/session", (request, response) => {
    response.json(sessionPayload(request));
  });

  registerOauthProvider({
    path: "google",
    client: googleOauthClient,
    linkIntent: "link_google"
  });
  registerOauthProvider({
    path: "discord",
    client: discordOauthClient,
    linkIntent: "link_discord"
  });
  registerOauthProvider({
    path: "twitch",
    client: twitchOauthClient,
    linkIntent: "link_twitch"
  });

  router.post("/logout", async (request, response, next) => {
    try {
      await destroySession(request);
      clearSessionCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
};
