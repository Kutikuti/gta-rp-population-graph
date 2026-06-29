import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity
} from "../services/auth.js";
import type { GoogleOauthClient } from "../services/google-oauth.js";

const singleIdentityUser: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000921",
  email: "solo@example.test",
  displayName: "Solo Example",
  mustChooseDisplayName: false,
  avatarUrl: null,
  role: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "user"
  },
  isBanned: false,
  linkedIdentities: [
    {
      id: "identity-google-solo",
      provider: "google",
      connectedAt: "2026-06-28T00:00:00.000Z",
      lastUsedAt: "2026-06-28T00:00:00.000Z",
      canUnlink: false
    }
  ]
};

const multiIdentityUser: AuthenticatedUser = {
  ...singleIdentityUser,
  id: "00000000-0000-4000-8000-000000000922",
  email: "multi@example.test",
  displayName: "Multi Example",
  linkedIdentities: [
    {
      id: "identity-google-multi",
      provider: "google",
      connectedAt: "2026-06-28T00:00:00.000Z",
      lastUsedAt: "2026-06-28T00:00:00.000Z",
      canUnlink: true
    },
    {
      id: "identity-discord-multi",
      provider: "discord",
      connectedAt: "2026-06-28T00:00:00.000Z",
      lastUsedAt: null,
      canUnlink: true
    }
  ]
};

const usersByCode = {
  solo: singleIdentityUser,
  multi: multiIdentityUser
} satisfies Record<string, AuthenticatedUser>;

class FixtureAuthService implements AuthService {
  private readonly usersById = new Map(
    Object.values(usersByCode).map((user) => [user.id, structuredClone(user)] as const)
  );

  async getSessionUser(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult> {
    const user = this.usersById.get(
      usersByCode[identity.providerUserId as keyof typeof usersByCode]?.id ?? ""
    );

    if (!user) {
      throw new Error(`Unknown fixture identity ${identity.providerUserId}.`);
    }

    return { status: "authenticated", user };
  }

  async linkIdentity() {
    return null;
  }

  async updateDisplayName(userId: string, displayName: string) {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      displayName,
      mustChooseDisplayName: false
    };
    this.usersById.set(userId, updatedUser);

    return updatedUser;
  }

  async unlinkIdentity(userId: string, provider: "google" | "discord" | "twitch") {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    const identities = user.linkedIdentities.filter((identity) => identity.provider !== provider);

    if (identities.length === user.linkedIdentities.length) {
      return null;
    }

    if (identities.length === 0) {
      return "last_identity" as const;
    }

    const updatedUser = {
      ...user,
      linkedIdentities: identities.map((identity) => ({
        ...identity,
        canUnlink: identities.length > 1
      }))
    };
    this.usersById.set(userId, updatedUser);

    return updatedUser;
  }
}

class FixtureGoogleOauthClient implements GoogleOauthClient {
  buildAuthorizationUrl(state: string) {
    return `https://accounts.example.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCodeForProfile(code: string): Promise<ExternalIdentity> {
    return {
      provider: "google",
      providerUserId: code,
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

describe("profile API", () => {
  it("refuses to dissociate the last linked identity", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "solo");

    const response = await agent.delete("/api/profile/identities/google");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_IDENTITY");
  });

  it("dissociates one identity when another login provider remains", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "multi");

    const response = await agent.delete("/api/profile/identities/google");

    expect(response.status).toBe(200);
    expect(response.body.user.linkedIdentities).toEqual([
      expect.objectContaining({
        provider: "discord",
        canUnlink: false
      })
    ]);
  });
});
