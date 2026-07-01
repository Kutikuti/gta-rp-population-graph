import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity
} from "../services/auth.js";
import type {
  ChangeDiff,
  ChangeRequestService,
  ChangeRequestSummary,
  CharacterSnapshot
} from "../services/change-requests.js";
import type { GoogleOauthClient } from "../services/google-oauth.js";

const ids = {
  character: "00000000-0000-4000-8000-000000000301",
  request: "00000000-0000-4000-8000-000000000701",
  user: "00000000-0000-4000-8000-000000000911",
  moderator: "00000000-0000-4000-8000-000000000912"
};

const usersByCode = {
  user: {
    id: ids.user,
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
    id: ids.moderator,
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
  }
} satisfies Record<string, AuthenticatedUser>;

const snapshot: CharacterSnapshot = {
  firstName: "Camille",
  lastName: "Morel",
  nickname: "Cami",
  birthDate: null,
  lifeStatus: "alive",
  deathOrDepartureDate: null,
  photoUrl: null,
  companyName: "Blue Line Logistics",
  companyRank: "Responsable planning",
  companyBadgeNumber: "BL-17",
  phoneNumbers: ["555-0101"],
  streamerId: null,
  streamerName: null,
  socialLinks: null,
  groupName: "Quartier Nord",
  district: "Nord",
  isRpDeath: false,
  relationships: [],
  previousCharacters: null,
  verificationStatus: "community",
  sourceNote: "Correction proposee."
};

const summary = (status: ChangeRequestSummary["status"]): ChangeRequestSummary => ({
  id: ids.request,
  requestType: "update",
  characterId: ids.character,
  characterName: "Camille Morel",
  proposedStreamerName: null,
  userId: ids.user,
  userDisplayName: "User Example",
  status,
  proposedSnapshot: snapshot,
  searchContext: null,
  reviewerId: status === "pending" ? null : ids.moderator,
  reviewerDisplayName: status === "pending" ? null : "Moderator Example",
  moderatorComment: status === "rejected" ? "Source insuffisante." : null,
  resolvedAt: status === "pending" ? null : "2026-06-18T12:00:00.000Z",
  createdAt: "2026-06-18T11:00:00.000Z",
  updatedAt: "2026-06-18T12:00:00.000Z"
});

class FixtureAuthService implements AuthService {
  private readonly usersById: Map<string, AuthenticatedUser> = new Map(
    Object.values(usersByCode).map((user) => [user.id, user] as const)
  );

  async getSessionUser(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult> {
    const user = usersByCode[identity.providerUserId as keyof typeof usersByCode];

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

class FixtureChangeRequestService implements ChangeRequestService {
  public lastCreatedBy: string | null = null;
  public lastRejectedComment: string | null = null;

  async createChangeRequest(input: {
    userId: string;
    characterId: string;
    proposedSnapshot: CharacterSnapshot;
  }) {
    this.lastCreatedBy = input.userId;

    if (input.characterId === ids.character) {
      return summary("pending");
    }

    return null;
  }

  async createCharacterCreationRequest(input: {
    userId: string;
    proposedSnapshot: CharacterSnapshot;
  }) {
    this.lastCreatedBy = input.userId;

    if (input.proposedSnapshot.firstName === "Camille") {
      return "duplicate" as const;
    }

    return {
      ...summary("pending"),
      requestType: "create" as const,
      characterId: null,
      characterName: `${input.proposedSnapshot.firstName} ${input.proposedSnapshot.lastName}`,
      proposedSnapshot: input.proposedSnapshot,
      searchContext: {
        q: `${input.proposedSnapshot.firstName} ${input.proposedSnapshot.lastName}`,
        company: "",
        lifeStatus: "",
        tag: "",
        streamer: "",
        verificationStatus: "",
        matchTotal: 0
      }
    };
  }

  async listUserChangeRequests() {
    return [summary("pending")];
  }

  async listModerationChangeRequests(status?: ChangeRequestSummary["status"]) {
    return [summary(status ?? "pending")];
  }

  async getModerationChangeRequest(id: string) {
    return id === ids.request ? summary("pending") : null;
  }

  async approveChangeRequest(input: { id: string; moderatorId: string }) {
    if (input.id !== ids.request) {
      return null;
    }

    const changes: ChangeDiff = {
      nickname: {
        old: null,
        new: "Cami"
      }
    };

    return { request: summary("approved"), changes };
  }

  async rejectChangeRequest(input: { id: string; moderatorId: string; comment: string }) {
    this.lastRejectedComment = input.comment;
    return input.id === ids.request ? summary("rejected") : null;
  }

  async editCharacterDirectly(input: {
    characterId: string;
    moderatorId: string;
    snapshot: CharacterSnapshot;
  }) {
    if (input.characterId !== ids.character) {
      return null;
    }

    return {
      characterId: input.characterId,
      changes: {
        sourceNote: {
          old: null,
          new: input.snapshot.sourceNote
        }
      }
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

const createFixtureApp = (service = new FixtureChangeRequestService()) => ({
  app: createApp({
    authService: new FixtureAuthService(),
    googleOauthClient: new FixtureGoogleOauthClient(),
    changeRequestService: service
  }),
  service
});

describe("change request routes", () => {
  it("creates a contribution request for an authenticated user", async () => {
    const { app, service } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.post("/api/contributions/change-requests").send({
      characterId: ids.character,
      proposedSnapshot: snapshot
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: ids.request,
      status: "pending",
      characterName: "Camille Morel"
    });
    expect(service.lastCreatedBy).toBe(ids.user);
  });

  it("rejects oversized character photo drafts before processing the file", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent
      .post(`/api/contributions/characters/${ids.character}/photo-drafts`)
      .set("Content-Type", "image/png")
      .send(Buffer.alloc(2_097_153));

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects invalid contribution snapshots", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.post("/api/contributions/change-requests").send({
      characterId: ids.character,
      proposedSnapshot: {
        ...snapshot,
        firstName: "",
        unsafeServerField: true
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a moderated character creation request after an empty search", async () => {
    const { app, service } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent
      .post("/api/contributions/change-requests/character-creations")
      .send({
        proposedSnapshot: {
          ...snapshot,
          firstName: "Nadia",
          lastName: "Soler"
        },
        searchContext: {
          q: "Nadia Soler",
          company: "",
          lifeStatus: "",
          tag: "",
          streamer: "",
          verificationStatus: "",
          matchTotal: 0
        }
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      requestType: "create",
      characterId: null,
      characterName: "Nadia Soler"
    });
    expect(service.lastCreatedBy).toBe(ids.user);
  });

  it("rejects an obvious duplicate character creation request", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent
      .post("/api/contributions/change-requests/character-creations")
      .send({
        proposedSnapshot: snapshot,
        searchContext: {
          q: "Camille Morel",
          company: "",
          lifeStatus: "",
          tag: "",
          streamer: "",
          verificationStatus: "",
          matchTotal: 0
        }
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("POSSIBLE_DUPLICATE_CHARACTER");
  });

  it("keeps moderation routes restricted to moderators", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "user");

    const response = await agent.get("/api/moderation/change-requests");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("lets moderators approve and reject pending requests", async () => {
    const { app, service } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "moderator");

    const listResponse = await agent.get("/api/moderation/change-requests").query({
      status: "pending"
    });
    const approveResponse = await agent.post(
      `/api/moderation/change-requests/${ids.request}/approve`
    );
    const rejectResponse = await agent
      .post(`/api/moderation/change-requests/${ids.request}/reject`)
      .send({ comment: "Source insuffisante." });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body[0]).toMatchObject({ status: "pending" });
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body).toMatchObject({
      request: { status: "approved" },
      changes: { nickname: { new: "Cami" } }
    });
    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.status).toBe("rejected");
    expect(service.lastRejectedComment).toBe("Source insuffisante.");
  });

  it("requires a moderator comment on rejection", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "moderator");

    const response = await agent
      .post(`/api/moderation/change-requests/${ids.request}/reject`)
      .send({ comment: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lets moderators edit a character directly with history diff output", async () => {
    const { app } = createFixtureApp();
    const agent = request.agent(app);

    await loginAs(agent, "moderator");

    const response = await agent.patch(`/api/moderation/characters/${ids.character}`).send({
      snapshot: {
        ...snapshot,
        previousCharacters: {
          raw: "Otávio Lua Magalhães (03)",
          v6: []
        }
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      characterId: ids.character,
      changes: { sourceNote: { new: "Correction proposee." } }
    });
  });
});
