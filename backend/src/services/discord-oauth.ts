import { env } from "../config/env.js";
import type { ExternalIdentity } from "./auth.js";

export class DiscordOauthDisabledError extends Error {}

export class DiscordOauthExchangeError extends Error {}

export interface DiscordOauthClient {
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<ExternalIdentity>;
}

const ensureDiscordOauthEnabled = () => {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_CALLBACK_URL) {
    throw new DiscordOauthDisabledError("Discord OAuth is not configured.");
  }

  return {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    callbackUrl: env.DISCORD_CALLBACK_URL
  };
};

const discordAvatarUrl = (id: string, avatarHash: string | null | undefined) => {
  if (!avatarHash) {
    return null;
  }

  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${extension}`;
};

export class DiscordOidcClient implements DiscordOauthClient {
  buildAuthorizationUrl(state: string): string {
    const { clientId, callbackUrl } = ensureDiscordOauthEnabled();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "identify email",
      prompt: "consent",
      state
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    const { clientId, clientSecret, callbackUrl } = ensureDiscordOauthEnabled();
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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
      throw new DiscordOauthExchangeError("Discord token exchange failed.");
    }

    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenBody.access_token) {
      throw new DiscordOauthExchangeError("Discord token response is missing access_token.");
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`
      }
    });

    if (!profileResponse.ok) {
      throw new DiscordOauthExchangeError("Discord user request failed.");
    }

    const profileBody = (await profileResponse.json()) as {
      id?: string;
      email?: string | null;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    if (!profileBody.id || !profileBody.email || !profileBody.username) {
      throw new DiscordOauthExchangeError("Discord user response is incomplete.");
    }

    return {
      provider: "discord",
      providerUserId: profileBody.id,
      email: profileBody.email,
      displayName: profileBody.global_name ?? profileBody.username,
      avatarUrl: discordAvatarUrl(profileBody.id, profileBody.avatar)
    };
  }
}
