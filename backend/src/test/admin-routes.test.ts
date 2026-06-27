import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { RoleName } from "../db/enums.js";
import type {
  AdminDashboard,
  AdminNotionImportBatch,
  AdminNotionImportDetail,
  AdminNotionImportEntry,
  AdminService,
  AdminTag,
  AdminUser,
  BanInput,
  TagInput
} from "../services/admin.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  GoogleIdentity
} from "../services/auth.js";
import type { GoogleOauthClient, GoogleProfile } from "../services/google-oauth.js";

const authUsers = {
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
    isBanned: false
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
    isBanned: false
  }
} satisfies Record<string, AuthenticatedUser>;

const adminUser: AdminUser = {
  id: authUsers.user.id,
  email: authUsers.user.email,
  displayName: authUsers.user.displayName,
  role: authUsers.user.role,
  isBanned: false,
  createdAt: "2026-06-22T00:00:00.000Z",
  lastLoginAt: null
};

const adminTag: AdminTag = {
  id: "00000000-0000-4000-8000-000000000401",
  name: "Quartier Nord",
  type: "district",
  colorHex: "#2f9bff",
  description: null,
  usageCount: 2
};

const notionImportBatch: AdminNotionImportBatch = {
  id: "00000000-0000-4000-8000-000000000701",
  sourceName: "Flashback Whitelist V6",
  status: "reported",
  sourceSnapshot: { pageCount: 2 },
  totals: { new: 2 },
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z"
};

const notionImportDetail: AdminNotionImportDetail = {
  batch: notionImportBatch,
  entries: [
    {
      status: "new",
      pageId: "page-ada",
      fullName: "Ada Lovelace",
      lifeStatus: "alive",
      streamer: "AdaLive",
      twitch: "https://twitch.example/adalive",
      business: "Laboratoire",
      group: "Analystes",
      tags: "Tech",
      photoReferences: ["https://secure.notion-static.com/ada-avatar.webp"],
      sourceUrl: "https://example.test/page-ada",
      rawContent: { pageId: "page-ada" },
      mappedSnapshot: { firstName: "Ada", lastName: "Lovelace" },
      mappingReport: { errors: [] },
      appliedCharacterId: null,
      appliedAt: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    }
  ]
};

class FixtureAuthService implements AuthService {
  private readonly usersById = new Map(Object.values(authUsers).map((user) => [user.id, user]));

  async getSessionUser(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async authenticateGoogleIdentity(identity: GoogleIdentity): Promise<AuthResult> {
    const user = authUsers[identity.googleId as keyof typeof authUsers];

    if (!user) {
      throw new Error(`Unknown fixture Google identity ${identity.googleId}.`);
    }

    return { status: "authenticated", user };
  }

  async updateDisplayName(userId: string, displayName: string) {
    const user = this.usersById.get(userId);

    if (!user) {
      return null;
    }

    return { ...user, displayName, mustChooseDisplayName: false };
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

class FixtureAdminService implements AdminService {
  readonly dashboard: AdminDashboard = {
    users: [adminUser],
    tags: [adminTag],
    actions: []
  };

  async getDashboard() {
    return this.dashboard;
  }

  async listNotionImports() {
    return [notionImportBatch];
  }

  async getNotionImportDetail(batchId: string) {
    return batchId === notionImportBatch.id ? notionImportDetail : null;
  }

  async applyNotionImportEntry(_input: { actorUserId: string; batchId: string; pageId: string }) {
    const baseEntry = notionImportDetail.entries[0];

    if (!baseEntry) {
      throw new Error("Missing notion import entry fixture.");
    }

    const entry: AdminNotionImportEntry = {
      ...baseEntry,
      appliedCharacterId: "00000000-0000-4000-8000-000000000301",
      appliedAt: "2026-06-24T00:00:00.000Z"
    };

    return {
      status: "applied" as const,
      entry,
      characterId: "00000000-0000-4000-8000-000000000301",
      created: true
    };
  }

  async importNotionImportEntryPhoto(_input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }) {
    const baseEntry = notionImportDetail.entries[0];

    if (!baseEntry) {
      throw new Error("Missing notion import entry fixture.");
    }

    return {
      status: "imported" as const,
      entry: {
        ...baseEntry,
        appliedCharacterId: "00000000-0000-4000-8000-000000000301",
        appliedAt: "2026-06-24T00:00:00.000Z"
      },
      characterId: "00000000-0000-4000-8000-000000000301",
      photoUrl: "/uploads/characters/ada-photo.webp"
    };
  }

  async createTag(_actorUserId: string, input: TagInput) {
    return {
      id: "00000000-0000-4000-8000-000000000402",
      ...input,
      usageCount: 0
    };
  }

  async updateTag(_actorUserId: string, tagId: string, input: TagInput) {
    return tagId === "missing" ? null : { id: tagId, ...input, usageCount: 0 };
  }

  async deleteTag(_actorUserId: string, tagId: string) {
    return tagId === adminTag.id ? "in_use" : "deleted";
  }

  async updateUserRole(_actorUserId: string, userId: string, roleName: RoleName) {
    if (userId === "last-admin") {
      return "last_admin";
    }

    if (userId === "missing") {
      return null;
    }

    return {
      ...adminUser,
      id: userId,
      role: {
        id: `role-${roleName}`,
        name: roleName
      }
    };
  }

  async banUser(_actorUserId: string, userId: string, _input: BanInput) {
    return userId === "missing" ? null : { ...adminUser, id: userId, isBanned: true };
  }

  async revokeUserBan(_actorUserId: string, userId: string) {
    return userId === "missing" ? null : { ...adminUser, id: userId, isBanned: false };
  }
}

const oauthStateFromLocation = (location: string | undefined) => {
  const state = location ? new URL(location).searchParams.get("state") : null;

  if (!state) {
    throw new Error("OAuth state was not returned in the authorization URL.");
  }

  return state;
};

const loginAs = async (agent: ReturnType<typeof request.agent>, code: keyof typeof authUsers) => {
  const startResponse = await agent.get("/api/auth/google");
  const state = oauthStateFromLocation(startResponse.headers.location);

  await agent.get("/api/auth/google/callback").query({ code, state });
};

const createFixtureApp = (adminService: AdminService = new FixtureAdminService()) =>
  createApp({
    authService: new FixtureAuthService(),
    googleOauthClient: new FixtureGoogleOauthClient(),
    adminService
  });

describe("admin routes", () => {
  it("rejects simple users from the admin dashboard", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "user");

    const response = await agent.get("/api/admin/dashboard");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns the admin dashboard to administrators", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.get("/api/admin/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.tags[0]).toMatchObject({ name: "Quartier Nord", usageCount: 2 });
  });

  it("returns notion import batches to administrators", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.get("/api/admin/notion-imports");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: notionImportBatch.id,
      sourceName: "Flashback Whitelist V6"
    });
  });

  it("returns notion import detail to administrators", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.get(`/api/admin/notion-imports/${notionImportBatch.id}`);

    expect(response.status).toBe(200);
    expect(response.body.entries[0]).toMatchObject({
      fullName: "Ada Lovelace",
      status: "new"
    });
  });

  it("applies one notion import entry for administrators", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.post(
      `/api/admin/notion-imports/${notionImportBatch.id}/entries/page-ada/apply`
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "applied",
      characterId: "00000000-0000-4000-8000-000000000301",
      created: true,
      entry: {
        pageId: "page-ada",
        appliedCharacterId: "00000000-0000-4000-8000-000000000301"
      }
    });
  });

  it("imports one notion photo for administrators", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.post(
      `/api/admin/notion-imports/${notionImportBatch.id}/entries/page-ada/import-photo`
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "imported",
      characterId: "00000000-0000-4000-8000-000000000301",
      photoUrl: "/uploads/characters/ada-photo.webp"
    });
  });

  it("returns 400 when notion photo import fails with a request-style validation error", async () => {
    class InvalidPhotoAdminService extends FixtureAdminService {
      override async importNotionImportEntryPhoto() {
        return {
          status: "invalid" as const,
          code: "NOTION_IMPORT_ENTRY_INVALID_PHOTO",
          message: "La photo distante a été refusée."
        };
      }
    }

    const agent = request.agent(createFixtureApp(new InvalidPhotoAdminService()));
    await loginAs(agent, "administrator");

    const response = await agent.post(
      `/api/admin/notion-imports/${notionImportBatch.id}/entries/page-ada/import-photo`
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("NOTION_IMPORT_ENTRY_INVALID_PHOTO");
  });

  it("returns 404 when notion photo import targets a missing applied character", async () => {
    class MissingCharacterAdminService extends FixtureAdminService {
      override async importNotionImportEntryPhoto() {
        return {
          status: "invalid" as const,
          code: "NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND",
          message: "Le personnage lié à cette fiche importée est introuvable."
        };
      }
    }

    const agent = request.agent(createFixtureApp(new MissingCharacterAdminService()));
    await loginAs(agent, "administrator");

    const response = await agent.post(
      `/api/admin/notion-imports/${notionImportBatch.id}/entries/page-ada/import-photo`
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND");
  });

  it("validates tag creation payloads", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.post("/api/admin/tags").send({
      name: "A",
      type: "invalid",
      colorHex: "blue",
      description: ""
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks deleting tags that are still used", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.delete(`/api/admin/tags/${adminTag.id}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TAG_IN_USE");
  });

  it("blocks removing the last administrator", async () => {
    const agent = request.agent(createFixtureApp());
    await loginAs(agent, "administrator");

    const response = await agent.patch("/api/admin/users/last-admin/role").send({ role: "user" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ADMIN");
  });
});
