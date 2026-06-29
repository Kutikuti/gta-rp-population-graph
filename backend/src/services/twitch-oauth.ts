import { env } from "../config/env.js";
import type { ExternalIdentity } from "./auth.js";

export class TwitchOauthDisabledError extends Error {}

export class TwitchOauthExchangeError extends Error {}

export interface TwitchOauthClient {
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<ExternalIdentity>;
}

const ensureTwitchOauthEnabled = () => {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CALLBACK_URL) {
    throw new TwitchOauthDisabledError("Twitch OAuth is not configured.");
  }

  return {
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    callbackUrl: env.TWITCH_CALLBACK_URL
  };
};

export class TwitchOidcClient implements TwitchOauthClient {
  buildAuthorizationUrl(state: string): string {
    const { clientId, callbackUrl } = ensureTwitchOauthEnabled();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "user:read:email",
      state
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    const { clientId, clientSecret, callbackUrl } = ensureTwitchOauthEnabled();
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
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
      throw new TwitchOauthExchangeError("Twitch token exchange failed.");
    }

    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenBody.access_token) {
      throw new TwitchOauthExchangeError("Twitch token response is missing access_token.");
    }

    const profileResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`,
        "client-id": clientId
      }
    });

    if (!profileResponse.ok) {
      throw new TwitchOauthExchangeError("Twitch users request failed.");
    }

    const profileBody = (await profileResponse.json()) as {
      data?: Array<{
        id?: string;
        login?: string;
        display_name?: string;
        profile_image_url?: string;
        email?: string;
      }>;
    };
    const profile = profileBody.data?.[0];

    if (!profile?.id || !profile.email || !profile.display_name) {
      throw new TwitchOauthExchangeError("Twitch users response is incomplete.");
    }

    return {
      provider: "twitch",
      providerUserId: profile.id,
      email: profile.email,
      displayName: profile.display_name || profile.login || profile.email,
      avatarUrl: profile.profile_image_url ?? null
    };
  }
}
