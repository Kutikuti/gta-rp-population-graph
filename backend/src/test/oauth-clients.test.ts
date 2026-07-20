import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GOOGLE_CALLBACK_URL: "http://localhost:4000/api/auth/google/callback",
  DISCORD_CLIENT_ID: "discord-client",
  DISCORD_CLIENT_SECRET: "discord-secret",
  DISCORD_CALLBACK_URL: "http://localhost:4000/api/auth/discord/callback",
  TWITCH_CLIENT_ID: "twitch-client",
  TWITCH_CLIENT_SECRET: "twitch-secret",
  TWITCH_CALLBACK_URL: "http://localhost:4000/api/auth/twitch/callback"
}));

vi.mock("../config/env.js", () => ({ env: mockEnv }));

import {
  DiscordOauthDisabledError,
  DiscordOauthExchangeError,
  DiscordOidcClient
} from "../services/discord-oauth.js";
import {
  createOauthState,
  GoogleOauthDisabledError,
  GoogleOauthExchangeError,
  GoogleOidcClient
} from "../services/google-oauth.js";
import {
  TwitchOauthDisabledError,
  TwitchOauthExchangeError,
  TwitchOidcClient
} from "../services/twitch-oauth.js";

const response = (body: unknown, ok = true) =>
  ({ ok, json: vi.fn().mockResolvedValue(body) }) as unknown as Response;

type OauthClientFixture = {
  name: string;
  client: {
    buildAuthorizationUrl(state: string): string;
    exchangeCodeForProfile(code: string): Promise<unknown>;
  };
  authorizationHost: string;
  clientId: string;
  tokenUrl: string;
  profileUrl: string;
  profile: unknown;
  expectedIdentity: unknown;
  exchangeError: new (...args: never[]) => Error;
};

const fixtures: OauthClientFixture[] = [
  {
    name: "Google",
    client: new GoogleOidcClient(),
    authorizationHost: "accounts.google.com",
    clientId: "google-client",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    profile: { sub: "google-id", email: "user@example.com", name: "Public name" },
    expectedIdentity: {
      provider: "google",
      providerUserId: "google-id",
      email: "user@example.com",
      displayName: "Public name",
      avatarUrl: null
    },
    exchangeError: GoogleOauthExchangeError
  },
  {
    name: "Discord",
    client: new DiscordOidcClient(),
    authorizationHost: "discord.com",
    clientId: "discord-client",
    tokenUrl: "https://discord.com/api/oauth2/token",
    profileUrl: "https://discord.com/api/users/@me",
    profile: {
      id: "discord-id",
      email: "user@example.com",
      username: "fallback-name",
      global_name: "Public name",
      avatar: "a_avatar"
    },
    expectedIdentity: {
      provider: "discord",
      providerUserId: "discord-id",
      email: "user@example.com",
      displayName: "Public name",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-id/a_avatar.gif"
    },
    exchangeError: DiscordOauthExchangeError
  },
  {
    name: "Twitch",
    client: new TwitchOidcClient(),
    authorizationHost: "id.twitch.tv",
    clientId: "twitch-client",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    profileUrl: "https://api.twitch.tv/helix/users",
    profile: {
      data: [
        {
          id: "twitch-id",
          login: "streamer",
          display_name: "Public name",
          profile_image_url: "https://static.twitch.example/avatar.png",
          email: "user@example.com"
        }
      ]
    },
    expectedIdentity: {
      provider: "twitch",
      providerUserId: "twitch-id",
      email: "user@example.com",
      displayName: "Public name",
      avatarUrl: "https://static.twitch.example/avatar.png"
    },
    exchangeError: TwitchOauthExchangeError
  }
];

describe("OAuth clients", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates an unpredictable OAuth state", () => {
    const firstState = createOauthState();
    const secondState = createOauthState();

    expect(firstState).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondState).not.toBe(firstState);
  });

  it.each(fixtures)("builds the $name authorization URL", ({
    client,
    authorizationHost,
    clientId
  }) => {
    const url = new URL(client.buildAuthorizationUrl("state-value"));

    expect(url.host).toBe(authorizationHost);
    expect(url.searchParams.get("client_id")).toBe(clientId);
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it.each(fixtures)("exchanges a $name code for a normalized identity", async ({
    client,
    tokenUrl,
    profileUrl,
    profile,
    expectedIdentity
  }) => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response(profile));

    await expect(client.exchangeCodeForProfile("oauth-code")).resolves.toEqual(expectedIdentity);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(tokenUrl);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(profileUrl);
  });

  it.each(fixtures)("rejects a failed $name token exchange", async ({ client, exchangeError }) => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false));

    await expect(client.exchangeCodeForProfile("oauth-code")).rejects.toBeInstanceOf(exchangeError);
  });

  it.each(fixtures)("rejects a $name token without access token", async ({
    client,
    exchangeError
  }) => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}));

    await expect(client.exchangeCodeForProfile("oauth-code")).rejects.toBeInstanceOf(exchangeError);
  });

  it.each(fixtures)("rejects a failed $name profile request", async ({ client, exchangeError }) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response({}, false));

    await expect(client.exchangeCodeForProfile("oauth-code")).rejects.toBeInstanceOf(exchangeError);
  });

  it.each(fixtures)("rejects an incomplete $name profile", async ({ client, exchangeError }) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response({}));

    await expect(client.exchangeCodeForProfile("oauth-code")).rejects.toBeInstanceOf(exchangeError);
  });

  it("uses the Discord username and no avatar when optional profile fields are absent", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        response({
          id: "discord-id",
          email: "user@example.com",
          username: "fallback-name",
          global_name: null,
          avatar: null
        })
      );

    await expect(new DiscordOidcClient().exchangeCodeForProfile("oauth-code")).resolves.toEqual(
      expect.objectContaining({ displayName: "fallback-name", avatarUrl: null })
    );
  });

  it("rejects authorization when providers are disabled", () => {
    const googleClientId = mockEnv.GOOGLE_CLIENT_ID;
    const discordClientId = mockEnv.DISCORD_CLIENT_ID;
    const twitchClientId = mockEnv.TWITCH_CLIENT_ID;
    mockEnv.GOOGLE_CLIENT_ID = "";
    mockEnv.DISCORD_CLIENT_ID = "";
    mockEnv.TWITCH_CLIENT_ID = "";

    expect(() => new GoogleOidcClient().buildAuthorizationUrl("state")).toThrow(
      GoogleOauthDisabledError
    );
    expect(() => new DiscordOidcClient().buildAuthorizationUrl("state")).toThrow(
      DiscordOauthDisabledError
    );
    expect(() => new TwitchOidcClient().buildAuthorizationUrl("state")).toThrow(
      TwitchOauthDisabledError
    );

    mockEnv.GOOGLE_CLIENT_ID = googleClientId;
    mockEnv.DISCORD_CLIENT_ID = discordClientId;
    mockEnv.TWITCH_CLIENT_ID = twitchClientId;
  });
});
