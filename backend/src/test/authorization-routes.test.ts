import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity
} from "../services/auth.js";
import type { GoogleOauthClient } from "../services/google-oauth.js";

const usersByCode = {
  user: {
    id: "00000000-0000-4000-8000-000000000911",
    email: "user@example.test",
    displayName: "User Example",
    mustChooseDisplayName: false,
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "user"
    },
    isBanned: false,
    linkedIdentities: []
  },
  moderator: {
    id: "00000000-0000-4000-8000-000000000912",
    email: "moderator@example.test",
    displayName: "Moderator Example",
    mustChooseDisplayName: false,
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "moderator"
    },
    isBanned: false,
    linkedIdentities: []
  },
  administrator: {
    id: "00000000-0000-4000-8000-000000000913",
    email: "administrator@example.test",
    displayName: "Administrator Example",
    mustChooseDisplayName: false,
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000003",
      name: "administrator"
    },
    isBanned: false,
    linkedIdentities: []
  },
  banned: {
    id: "00000000-0000-4000-8000-000000000914",
    email: "banned@example.test",
    displayName: "Banned Example",
    mustChooseDisplayName: false,
    avatarUrl: null,
    role: {
      id: "00000000-0000-4000-8000-000000000003",
      name: "administrator"
    },
    isBanned: true,
    linkedIdentities: []
  }
} satisfies Record<string, AuthenticatedUser>;

class FixtureAuthService implements AuthService {
  private readonly usersById: Map<string, AuthenticatedUser> = new Map(
    Object.values(usersByCode).map((user) => [user.id, user] as const)
  );

  async getSessionUser(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult> {
    const roleKey = identity.providerUserId as keyof typeof usersByCode;
    const user = usersByCode[roleKey];

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

  async unlinkIdentity() {
    return "last_identity" as const;
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
  const state = oauthStateFromLocation(startResponse.headers["location"]);

  await agent.get("/api/auth/google/callback").query({ code, state });
};

const protectedEndpoints = [
  ["get", "/contributions/session", "user"],
  ["get", "/contributions/change-requests", "user"],
  ["post", "/contributions/change-requests", "user"],
  ["post", "/contributions/change-requests/character-creations", "user"],
  ["post", "/contributions/characters/target/photo-drafts", "user"],
  ["get", "/profile", "user"],
  ["get", "/profile/personal-data", "user"],
  ["patch", "/profile/display-name", "user"],
  ["delete", "/profile/identities/google", "user"],
  ["get", "/moderation/session", "moderator"],
  ["get", "/moderation/completeness", "moderator"],
  ["get", "/moderation/change-requests", "moderator"],
  ["get", "/moderation/change-requests/target", "moderator"],
  ["post", "/moderation/change-requests/target/approve", "moderator"],
  ["post", "/moderation/change-requests/target/reject", "moderator"],
  ["post", "/moderation/characters", "moderator"],
  ["patch", "/moderation/characters/target", "moderator"],
  ["get", "/admin/session", "administrator"],
  ["get", "/admin/dashboard", "administrator"],
  ["get", "/admin/completeness", "administrator"],
  ["get", "/admin/users/target/personal-data", "administrator"],
  ["delete", "/admin/users/target/personal-data", "administrator"],
  ["delete", "/admin/users/target/sessions", "administrator"],
  ["delete", "/admin/users/target/identities/google", "administrator"],
  ["patch", "/admin/users/target/role", "administrator"],
  ["post", "/admin/users/target/ban", "administrator"],
  ["delete", "/admin/users/target/ban", "administrator"],
  ["get", "/admin/notion-imports", "administrator"],
  ["get", "/admin/notion-imports/target", "administrator"],
  ["post", "/admin/notion-imports/target/entries/page/apply", "administrator"],
  ["post", "/admin/notion-imports/target/entries/page/import-photo", "administrator"],
  ["post", "/admin/tags", "administrator"],
  ["patch", "/admin/tags/target", "administrator"],
  ["delete", "/admin/tags/target", "administrator"]
] as const;

describe.each(["anonymous", "banned", "user", "moderator"] as const)(
  "access denial matrix: %s",
  (actor) => {
    const ranks = { anonymous: 0, banned: 0, user: 1, moderator: 2, administrator: 3 };
    it.each(protectedEndpoints.filter(([, , role]) => ranks[actor] < ranks[role]))(
      "blocks %s %s before payload validation or persistence",
      async (method, path) => {
        const authService = new FixtureAuthService();
        const app = createApp({ authService, googleOauthClient: new FixtureGoogleOauthClient() });
        const agent = request.agent(app);
        if (actor !== "anonymous") {
          await loginAs(agent, actor === "banned" ? "administrator" : actor);
          if (actor === "banned")
            vi.spyOn(authService, "getSessionUser").mockResolvedValue({
              ...usersByCode.administrator,
              isBanned: true
            });
        }
        const response = await agent[method](`/api${path}`).send({
          role: "administrator",
          userId: usersByCode.administrator.id
        });
        expect(response.status).toBe(ranks[actor] === 0 ? 401 : 403);
        expect(response.body.error.code).toBe(
          ranks[actor] === 0 ? "AUTHENTICATION_REQUIRED" : "FORBIDDEN"
        );
      }
    );
  }
);

describe("write origin protection", () => {
  it.each(["https://evil.test", "null", `${new URL(env.WEB_CLIENT_URL).origin}.evil.test`])(
    "rejects a logged-in write from %s",
    async (origin) => {
      const authService = new FixtureAuthService();
      const update = vi.spyOn(authService, "updateDisplayName");
      const agent = request.agent(
        createApp({ authService, googleOauthClient: new FixtureGoogleOauthClient() })
      );
      await loginAs(agent, "user");
      const response = await agent
        .patch("/api/profile/display-name")
        .set("Origin", origin)
        .send({ displayName: "Changed name" });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("UNTRUSTED_REQUEST_ORIGIN");
      expect(update).not.toHaveBeenCalled();
    }
  );

  it.each(["cross-site", "same-site"])("rejects %s writes without Origin", async (fetchSite) => {
    const response = await request(createApp())
      .post("/api/auth/logout")
      .set("Sec-Fetch-Site", fetchSite);
    expect(response.status).toBe(403);
  });

  it("accepts the exact configured origin and leaves public reads accessible", async () => {
    const agent = request.agent(
      createApp({
        authService: new FixtureAuthService(),
        googleOauthClient: new FixtureGoogleOauthClient()
      })
    );
    await loginAs(agent, "user");
    expect(
      (
        await agent
          .patch("/api/profile/display-name")
          .set("Origin", new URL(env.WEB_CLIENT_URL).origin)
          .send({ displayName: "Changed name" })
      ).status
    ).toBe(200);
    expect((await agent.get("/api/health").set("Origin", "https://evil.test")).status).toBe(200);
  });
});

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

  it("redirects anonymous users away from supervision", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });

    const response = await request(app).get("/api/supervision/authorize");

    expect(response.status).toBe(302);
    expect(response.headers["location"]).toBe("/?login=required&redirect=/supervision/");
  });

  it("rejects a simple user from supervision", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.get("/api/supervision/authorize");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an administrator into supervision", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "administrator");

    const response = await agent.get("/api/supervision/authorize");

    expect(response.status).toBe(204);
    expect(response.headers["x-webauth-user"]).toBe("Administrator Example");
  });

  it("rejects a banned user from supervision", async () => {
    const app = createApp({
      authService: new FixtureAuthService(),
      googleOauthClient: new FixtureGoogleOauthClient()
    });
    const agent = request.agent(app);

    await loginAs(agent, "banned");

    const response = await agent.get("/api/supervision/authorize");

    expect(response.status).toBe(302);
    expect(response.headers["location"]).toBe("/?login=required&redirect=/supervision/");
  });
});
