import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity,
  LinkIdentityResult
} from "../services/auth.js";
import type { DiscordOauthClient } from "../services/discord-oauth.js";
import type { GoogleOauthClient } from "../services/google-oauth.js";
import type { TwitchOauthClient } from "../services/twitch-oauth.js";

const baseUser: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000901",
  email: "viewer@example.test",
  displayName: "Viewer Example",
  mustChooseDisplayName: false,
  avatarUrl: "https://example.test/avatar.png",
  role: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "user"
  },
  isBanned: false,
  linkedIdentities: [
    {
      id: "identity-google-viewer",
      provider: "google",
      connectedAt: "2026-06-28T00:00:00.000Z",
      lastUsedAt: "2026-06-28T00:00:00.000Z",
      canUnlink: false
    }
  ]
};

class FixtureAuthService implements AuthService {
  private currentUser: AuthenticatedUser = baseUser;

  constructor(private readonly bannedGoogleIds = new Set<string>()) {}

  async getSessionUser(userId: string) {
    return userId === this.currentUser.id ? this.currentUser : null;
  }

  async authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult> {
    if (identity.email === "existing-account@example.test") {
      return { status: "email_in_use" };
    }

    const user = {
      ...baseUser,
      email: identity.email,
      displayName: identity.displayName,
      mustChooseDisplayName: false,
      avatarUrl: identity.avatarUrl,
      isBanned: identity.provider === "google" && this.bannedGoogleIds.has(identity.providerUserId),
      linkedIdentities: [
        {
          id: `identity-${identity.provider}-viewer`,
          provider: identity.provider as "google" | "discord" | "twitch",
          connectedAt: "2026-06-28T00:00:00.000Z",
          lastUsedAt: "2026-06-28T00:00:00.000Z",
          canUnlink: false
        }
      ]
    };

    this.currentUser = user;

    return user.isBanned ? { status: "banned", user } : { status: "authenticated", user };
  }

  async linkIdentity(
    userId: string,
    identity: ExternalIdentity
  ): Promise<LinkIdentityResult | null> {
    if (userId !== baseUser.id) {
      return null;
    }

    if (identity.providerUserId === `${identity.provider}-in-use-id`) {
      return { status: "linked_to_other_user" as const };
    }

    if (identity.providerUserId === `${identity.provider}-already-linked-id`) {
      const user = {
        ...baseUser,
        linkedIdentities: [
          {
            id: `identity-${identity.provider}-viewer`,
            provider: identity.provider as "google" | "discord" | "twitch",
            connectedAt: "2026-06-28T00:00:00.000Z",
            lastUsedAt: "2026-06-28T00:00:00.000Z",
            canUnlink: false
          }
        ]
      };
      this.currentUser = user;

      return {
        status: "already_linked" as const,
        user
      };
    }

    if (identity.providerUserId === `${identity.provider}-different-linked-id`) {
      return { status: "different_identity_already_linked" as const };
    }

    const user = {
      ...baseUser,
      linkedIdentities: [
        {
          id: `identity-${identity.provider === "google" ? "discord" : identity.provider}-viewer`,
          provider:
            identity.provider === "google"
              ? ("discord" as const)
              : (identity.provider as "google" | "discord" | "twitch"),
          connectedAt: "2026-06-28T00:00:00.000Z",
          lastUsedAt: null,
          canUnlink: true
        },
        {
          id: "identity-google-viewer",
          provider: "google" as const,
          connectedAt: "2026-06-29T00:00:00.000Z",
          lastUsedAt: "2026-06-29T00:00:00.000Z",
          canUnlink: true
        }
      ]
    };
    this.currentUser = user;

    return {
      status: "linked" as const,
      user
    };
  }

  async updateDisplayName(userId: string, displayName: string) {
    if (userId !== baseUser.id) {
      return null;
    }

    return {
      ...baseUser,
      displayName,
      mustChooseDisplayName: false
    };
  }

  async unlinkIdentity() {
    return "last_identity" as const;
  }
}

class FixtureGoogleOauthClient implements GoogleOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://accounts.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    if (code === "broken") {
      throw new Error("exchange failed");
    }

    return {
      provider: "google",
      providerUserId:
        code === "banned"
          ? "google-banned-id"
          : code === "in-use"
            ? "google-in-use-id"
            : code === "already-linked"
              ? "google-already-linked-id"
              : code === "different-linked"
                ? "google-different-linked-id"
                : "google-ok-id",
      email:
        code === "banned"
          ? "banned@example.test"
          : code === "existing-account"
            ? "existing-account@example.test"
            : "viewer@example.test",
      displayName: code === "banned" ? "Banned User" : "Viewer Example",
      avatarUrl: "https://example.test/avatar.png"
    };
  }
}

class FixtureDiscordOauthClient implements DiscordOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://discord.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    if (code === "broken") {
      throw new Error("exchange failed");
    }

    return {
      provider: "discord",
      providerUserId:
        code === "in-use"
          ? "discord-in-use-id"
          : code === "already-linked"
            ? "discord-already-linked-id"
            : code === "different-linked"
              ? "discord-different-linked-id"
              : "discord-ok-id",
      email: "viewer@example.test",
      displayName: "Viewer Example",
      avatarUrl: "https://example.test/discord-avatar.png"
    };
  }
}

class FixtureTwitchOauthClient implements TwitchOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://twitch.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    if (code === "broken") {
      throw new Error("exchange failed");
    }

    return {
      provider: "twitch",
      providerUserId:
        code === "in-use"
          ? "twitch-in-use-id"
          : code === "already-linked"
            ? "twitch-already-linked-id"
            : code === "different-linked"
              ? "twitch-different-linked-id"
              : "twitch-ok-id",
      email: "viewer@example.test",
      displayName: "Viewer Example",
      avatarUrl: "https://example.test/twitch-avatar.png"
    };
  }
}

const oauthStateFromLocation = (location: string | undefined) => {
  const state = location ? new URL(location).searchParams.get("state") : null;

  if (!state) {
    throw new Error("OAuth state was not returned in the authorization URL.");
  }

  return state;
};

describe("auth API", () => {
  it("returns an anonymous session when no user is connected", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });

    const response = await request(app).get("/api/auth/session");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false });
  });

  it("starts Google OAuth and exposes the session after callback", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/google");

    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.location;
    expect(location).toContain("https://accounts.example.test/oauth");

    const state = oauthStateFromLocation(location);

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "ok", state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=success");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        id: baseUser.id,
        email: "viewer@example.test",
        role: { name: "user" },
        linkedIdentities: [{ provider: "google" }]
      }
    });
  });

  it("starts Discord OAuth and exposes the session after callback", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient(),
      discordOauthClient: new FixtureDiscordOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/discord");

    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.location;
    expect(location).toContain("https://discord.example.test/oauth");

    const state = oauthStateFromLocation(location);

    const callbackResponse = await agent
      .get("/api/auth/discord/callback")
      .query({ code: "ok", state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=success");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        id: baseUser.id,
        email: "viewer@example.test",
        role: { name: "user" },
        linkedIdentities: [{ provider: "discord" }]
      }
    });
  });

  it("starts Twitch OAuth and exposes the session after callback", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient(),
      twitchOauthClient: new FixtureTwitchOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/twitch");

    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.location;
    expect(location).toContain("https://twitch.example.test/oauth");

    const state = oauthStateFromLocation(location);

    const callbackResponse = await agent
      .get("/api/auth/twitch/callback")
      .query({ code: "ok", state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=success");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        id: baseUser.id,
        email: "viewer@example.test",
        role: { name: "user" },
        linkedIdentities: [{ provider: "twitch" }]
      }
    });
  });

  it("refuses a Google callback with an invalid state", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await agent.get("/api/auth/google");

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "ok", state: "wrong-state" });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/?auth_error=invalid_state"
    );
  });

  it("keeps banned users out of the session", async () => {
    const app = createApp({
      authService: new FixtureAuthService(new Set(["google-banned-id"])),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/google");
    const state = oauthStateFromLocation(startResponse.headers.location);

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "banned", state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth_error=banned");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toEqual({ authenticated: false });
  });

  it("refuses implicit account merge when the provider email already belongs to another account", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/google");
    const state = oauthStateFromLocation(startResponse.headers.location);

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "existing-account", state });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/?auth_error=identity_email_in_use"
    );

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toEqual({ authenticated: false });
  });

  it("logs out and destroys the server session", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startResponse = await agent.get("/api/auth/google");
    const state = oauthStateFromLocation(startResponse.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state });

    const logoutResponse = await agent.post("/api/auth/logout");

    expect(logoutResponse.status).toBe(204);

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toEqual({ authenticated: false });
  });

  it("starts Google linking for an authenticated user and confirms the linked identity", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/google/link");
    expect(startLinkResponse.status).toBe(302);

    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);
    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "ok", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=identity_linked");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        linkedIdentities: [{ provider: "discord" }, { provider: "google" }]
      }
    });
  });

  it("starts Discord linking for an authenticated user and confirms the linked identity", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient(),
      discordOauthClient: new FixtureDiscordOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/discord/link");
    expect(startLinkResponse.status).toBe(302);
    expect(startLinkResponse.headers.location).toContain("https://discord.example.test/oauth");

    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);
    const callbackResponse = await agent
      .get("/api/auth/discord/callback")
      .query({ code: "ok", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=identity_linked");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        linkedIdentities: [{ provider: "discord" }, { provider: "google" }]
      }
    });
  });

  it("starts Twitch linking for an authenticated user and confirms the linked identity", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient(),
      twitchOauthClient: new FixtureTwitchOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/twitch/link");
    expect(startLinkResponse.status).toBe(302);
    expect(startLinkResponse.headers.location).toContain("https://twitch.example.test/oauth");

    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);
    const callbackResponse = await agent
      .get("/api/auth/twitch/callback")
      .query({ code: "ok", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/?auth=identity_linked");

    const sessionResponse = await agent.get("/api/auth/session");

    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        linkedIdentities: [{ provider: "twitch" }, { provider: "google" }]
      }
    });
  });

  it("redirects with a dedicated error when the Google identity is already linked elsewhere", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/google/link");
    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "in-use", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/?auth_error=identity_in_use"
    );
  });

  it("rejects linking a different Google account when another Google identity is already linked on the profile", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/google/link");
    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "different-linked", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/?auth_error=different_identity_already_linked"
    );
  });

  it("rejects a Google link callback when the authenticated session no longer matches", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    const startLogin = await agent.get("/api/auth/google");
    const loginState = oauthStateFromLocation(startLogin.headers.location);
    await agent.get("/api/auth/google/callback").query({ code: "ok", state: loginState });

    const startLinkResponse = await agent.get("/api/auth/google/link");
    const linkState = oauthStateFromLocation(startLinkResponse.headers.location);
    await agent.post("/api/auth/logout");

    const callbackResponse = await agent
      .get("/api/auth/google/callback")
      .query({ code: "ok", state: linkState });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/?auth_error=invalid_state"
    );
  });
});
