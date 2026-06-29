import { env } from "../config/env.js";
import type { SocialLinks } from "../db/models/index.js";

export type TwitchLiveStatus = "live" | "offline" | "unknown";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

type StatusCacheEntry = {
  expiresAt: number;
  status: TwitchLiveStatus;
};

const LIVE_CACHE_TTL_MS = 120_000;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 4_000;

const normalizeTwitchLogin = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = (() => {
    try {
      const url = new URL(trimmed);
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return trimmed;
    }
  })();

  const login = normalized.replace(/^@/, "").trim().toLowerCase();

  if (!/^[a-z0-9_]{4,25}$/i.test(login)) {
    return null;
  }

  return login;
};

const twitchLoginFromLinks = (socialLinks: SocialLinks | null | undefined) =>
  socialLinks?.twitch ? normalizeTwitchLogin(socialLinks.twitch) : null;

const withTimeout = async (input: string | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export class TwitchLiveStatusService {
  #tokenCache: TokenCache | null = null;
  #statusCache = new Map<string, StatusCacheEntry>();

  async getStatusForSocialLinks(
    socialLinks: SocialLinks | null | undefined
  ): Promise<TwitchLiveStatus> {
    const login = twitchLoginFromLinks(socialLinks);

    if (!login) {
      return "unknown";
    }

    return this.getStatusForLogin(login);
  }

  async getStatusForLogin(login: string): Promise<TwitchLiveStatus> {
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
      return "unknown";
    }

    const cached = this.#statusCache.get(login);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.status;
    }

    const status = await this.#loadStatus(login);
    this.#statusCache.set(login, {
      status,
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS
    });

    return status;
  }

  async #loadStatus(login: string): Promise<TwitchLiveStatus> {
    try {
      const accessToken = await this.#getAppAccessToken();

      if (!accessToken) {
        return "unknown";
      }

      const url = new URL("https://api.twitch.tv/helix/streams");
      url.searchParams.set("user_login", login);

      const response = await withTimeout(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          "client-id": env.TWITCH_CLIENT_ID
        }
      });

      if (!response.ok) {
        return "unknown";
      }

      const body = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };

      return body.data?.length ? "live" : "offline";
    } catch {
      return "unknown";
    }
  }

  async #getAppAccessToken(): Promise<string | null> {
    if (this.#tokenCache && this.#tokenCache.expiresAt > Date.now()) {
      return this.#tokenCache.accessToken;
    }

    const clientId = env.TWITCH_CLIENT_ID;
    const clientSecret = env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    try {
      const response = await withTimeout("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams([
          ["client_id", clientId],
          ["client_secret", clientSecret],
          ["grant_type", "client_credentials"]
        ])
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
      };

      if (!body.access_token || !body.expires_in) {
        return null;
      }

      this.#tokenCache = {
        accessToken: body.access_token,
        expiresAt: Date.now() + body.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS
      };

      return body.access_token;
    } catch {
      return null;
    }
  }
}

export const twitchLiveTestUtils = {
  normalizeTwitchLogin,
  twitchLoginFromLinks
};
