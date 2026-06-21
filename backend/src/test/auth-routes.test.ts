import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  GoogleIdentity
} from "../services/auth.js";
import type { GoogleOauthClient, GoogleProfile } from "../services/google-oauth.js";

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
  isBanned: false
};

class FixtureAuthService implements AuthService {
  constructor(private readonly bannedGoogleIds = new Set<string>()) {}

  async getSessionUser(userId: string) {
    return userId === baseUser.id ? baseUser : null;
  }

  async authenticateGoogleIdentity(identity: GoogleIdentity): Promise<AuthResult> {
    const user = {
      ...baseUser,
      email: identity.email,
      displayName: identity.displayName,
      mustChooseDisplayName: false,
      avatarUrl: identity.avatarUrl,
      isBanned: this.bannedGoogleIds.has(identity.googleId)
    };

    return user.isBanned ? { status: "banned", user } : { status: "authenticated", user };
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
}

class FixtureGoogleOauthClient implements GoogleOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://accounts.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    if (code === "broken") {
      throw new Error("exchange failed");
    }

    return {
      googleId: code === "banned" ? "google-banned-id" : "google-ok-id",
      email: code === "banned" ? "banned@example.test" : "viewer@example.test",
      displayName: code === "banned" ? "Banned User" : "Viewer Example",
      avatarUrl: "https://example.test/avatar.png"
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
        role: { name: "user" }
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
});
