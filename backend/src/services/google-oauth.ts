import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import type { ExternalIdentity } from "./auth.js";

export class GoogleOauthDisabledError extends Error {}

export class GoogleOauthStateError extends Error {}

export class GoogleOauthExchangeError extends Error {}

export interface GoogleOauthClient {
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<ExternalIdentity>;
}

const ensureGoogleOauthEnabled = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    throw new GoogleOauthDisabledError("Google OAuth is not configured.");
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL
  };
};

export const createOauthState = () => randomUUID();

export class GoogleOidcClient implements GoogleOauthClient {
  buildAuthorizationUrl(state: string): string {
    const { clientId, callbackUrl } = ensureGoogleOauthEnabled();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    const { clientId, clientSecret, callbackUrl } = ensureGoogleOauthEnabled();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      throw new GoogleOauthExchangeError("Google token exchange failed.");
    }

    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenBody.access_token) {
      throw new GoogleOauthExchangeError("Google token response is missing access_token.");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`
      }
    });

    if (!profileResponse.ok) {
      throw new GoogleOauthExchangeError("Google userinfo request failed.");
    }

    const profileBody = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profileBody.sub || !profileBody.email || !profileBody.name) {
      throw new GoogleOauthExchangeError("Google userinfo response is incomplete.");
    }

    return {
      provider: "google",
      providerUserId: profileBody.sub,
      email: profileBody.email,
      displayName: profileBody.name,
      avatarUrl: profileBody.picture ?? null
    };
  }
}
