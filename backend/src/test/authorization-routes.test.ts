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

const usersByCode = {
  user: {
    id: "00000000-0000-4000-8000-000000000911",
    email: "user@example.test",
    displayName: "User Example",
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "user"
    },
    isBanned: false
  },
  moderator: {
    id: "00000000-0000-4000-8000-000000000912",
    email: "moderator@example.test",
    displayName: "Moderator Example",
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "moderator"
    },
    isBanned: false
  },
  administrator: {
    id: "00000000-0000-4000-8000-000000000913",
    email: "administrator@example.test",
    displayName: "Administrator Example",
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000003",
      name: "administrator"
    },
    isBanned: false
  }
} satisfies Record<string, AuthenticatedUser>;

class FixtureAuthService implements AuthService {
  private readonly usersById = new Map(
    Object.values(usersByCode).map((user) => [user.id, user] as const)
  );

  async getSessionUser(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async authenticateGoogleIdentity(identity: GoogleIdentity): Promise<AuthResult> {
    const roleKey = identity.googleId as keyof typeof usersByCode;
    const user = usersByCode[roleKey];

    if (!user) {
      throw new Error(`Unknown fixture Google identity ${identity.googleId}.`);
    }

    return { status: "authenticated", user };
  }
}

class FixtureGoogleOauthClient implements GoogleOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://accounts.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    return {
      googleId: code,
      email: `${code}@example.test`,
      displayName: code,
      avatarUrl: null
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

const loginAs = async (agent: ReturnType<typeof request.agent>, code: keyof typeof usersByCode) => {
  const startResponse = await agent.get("/api/auth/google");
  const state = oauthStateFromLocation(startResponse.headers.location);

  await agent.get("/api/auth/google/callback").query({ code, state });
};

describe("authorization routes", () => {
  it("rejects anonymous access to contributions", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });

    const response = await request(app).get("/api/contributions/session");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("allows an authenticated user into contributions", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.get("/api/contributions/session");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      area: "contributions",
      user: { role: { name: "user" } }
    });
  });

  it("rejects a simple user from moderation", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.get("/api/moderation/session");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a moderator into moderation", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "moderator");

    const response = await agent.get("/api/moderation/session");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      area: "moderation",
      user: { role: { name: "moderator" } }
    });
  });

  it("rejects a moderator from admin", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "moderator");

    const response = await agent.get("/api/admin/session");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an administrator into admin", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "administrator");

    const response = await agent.get("/api/admin/session");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      area: "administration",
      user: { role: { name: "administrator" } }
    });
  });
});
