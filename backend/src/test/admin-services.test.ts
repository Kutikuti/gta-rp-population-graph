import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const transaction = { id: "tx" };
  const sequelize = {
    col: vi.fn((value: string) => ({ col: value })),
    fn: vi.fn((name: string, value: unknown) => ({ fn: name, value })),
    literal: vi.fn((value: string) => ({ literal: value })),
    transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
      callback(transaction)
    ),
    where: vi.fn((left: unknown, right: unknown) => ({ left, right }))
  };
  const models = {
    AdminAction: {
      count: vi.fn(),
      create: vi.fn(),
      findOne: vi.fn()
    },
    Ban: {
      create: vi.fn(),
      update: vi.fn()
    },
    ChangeHistory: {
      count: vi.fn()
    },
    ChangeRequest: {
      findAll: vi.fn(),
      findOne: vi.fn()
    },
    CharacterTag: {
      count: vi.fn(),
      findAll: vi.fn()
    },
    Role: {
      findOne: vi.fn()
    },
    Tag: {
      create: vi.fn(),
      findAll: vi.fn(),
      findByPk: vi.fn()
    },
    User: {
      count: vi.fn(),
      findByPk: vi.fn()
    },
    UserIdentity: {
      destroy: vi.fn()
    },
    UserSession: {
      destroy: vi.fn(),
      findAll: vi.fn()
    }
  };

  return { models, sequelize, transaction };
});

vi.mock("../db/index.js", () => ({
  models: db.models,
  sequelize: db.sequelize
}));

const createUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-id",
  email: "user@example.test",
  displayName: "User Example",
  role: { id: "role-id", name: "user" },
  bans: [],
  identities: [],
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  lastLoginAt: null,
  update: vi.fn(),
  ...overrides
});

const createTag = (overrides: Record<string, unknown> = {}) => ({
  id: "tag-id",
  name: "Quartier Nord",
  type: "district",
  colorHex: "#2f9bff",
  description: null,
  destroy: vi.fn(),
  update: vi.fn(),
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SequelizeAdminTagService", () => {
  it("lists tags with their usage count", async () => {
    const { SequelizeAdminTagService } = await import("../services/admin-tags.js");
    db.models.Tag.findAll.mockResolvedValue([
      createTag({ id: "tag-a", name: "A" }),
      createTag({ id: "tag-b", name: "B" })
    ]);
    db.models.CharacterTag.findAll.mockResolvedValue([{ tagId: "tag-b", usageCount: "3" }]);

    await expect(new SequelizeAdminTagService().listTagsWithUsage()).resolves.toEqual([
      expect.objectContaining({ id: "tag-a", usageCount: 0 }),
      expect.objectContaining({ id: "tag-b", usageCount: 3 })
    ]);
  });

  it("creates, updates and deletes tags inside audited transactions", async () => {
    const { SequelizeAdminTagService } = await import("../services/admin-tags.js");
    const service = new SequelizeAdminTagService();
    const tag = createTag();
    const input = {
      name: "Quartier Sud",
      type: "district" as const,
      colorHex: "#ffffff",
      description: null
    };
    db.models.Tag.create.mockResolvedValue(tag);
    db.models.Tag.findByPk.mockResolvedValue(tag);
    db.models.CharacterTag.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await expect(service.createTag("actor-id", input)).resolves.toMatchObject({
      id: "tag-id",
      usageCount: 0
    });
    await expect(service.updateTag("actor-id", "tag-id", input)).resolves.toMatchObject({
      id: "tag-id",
      usageCount: 2
    });
    await expect(service.deleteTag("actor-id", "tag-id")).resolves.toBe("deleted");

    expect(tag.update).toHaveBeenCalledWith(input, { transaction: db.transaction });
    expect(tag.destroy).toHaveBeenCalledWith({ transaction: db.transaction });
    expect(db.models.AdminAction.create).toHaveBeenCalledTimes(3);
  });

  it("refuses to delete a tag that is still used", async () => {
    const { SequelizeAdminTagService } = await import("../services/admin-tags.js");
    db.models.Tag.findByPk.mockResolvedValue(createTag());
    db.models.CharacterTag.count.mockResolvedValue(1);

    await expect(new SequelizeAdminTagService().deleteTag("actor-id", "tag-id")).resolves.toBe(
      "in_use"
    );
    expect(db.models.AdminAction.create).not.toHaveBeenCalled();
  });
});

describe("SequelizeAdminUserAccessService", () => {
  it("protects the last administrator before changing a role", async () => {
    const { SequelizeAdminUserAccessService } = await import("../services/admin-user-access.js");
    db.models.User.findByPk.mockResolvedValue(
      createUser({ role: { id: "administrator-role", name: "administrator" } })
    );
    db.models.Role.findOne.mockResolvedValue({ id: "user-role", name: "user" });
    db.models.User.count.mockResolvedValue(1);

    await expect(
      new SequelizeAdminUserAccessService().updateUserRole("actor-id", "admin-id", "user")
    ).resolves.toBe("last_admin");
    expect(db.models.AdminAction.create).not.toHaveBeenCalled();
  });

  it("audits role changes and bans", async () => {
    const { SequelizeAdminUserAccessService } = await import("../services/admin-user-access.js");
    const service = new SequelizeAdminUserAccessService();
    const user = createUser({
      role: { id: "user-role", name: "user" },
      update: vi.fn().mockResolvedValue(undefined)
    });
    db.models.User.findByPk.mockResolvedValue(user);
    db.models.Role.findOne.mockResolvedValue({ id: "moderator-role", name: "moderator" });

    await expect(service.updateUserRole("actor-id", "user-id", "moderator")).resolves.toMatchObject(
      {
        id: "user-id",
        role: { name: "user" }
      }
    );
    await expect(service.banUser("actor-id", "user-id", { reason: "abus" })).resolves.toMatchObject(
      { id: "user-id" }
    );

    expect(user.update).toHaveBeenCalledWith(
      { roleId: "moderator-role" },
      { transaction: db.transaction }
    );
    expect(db.models.Ban.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "abus", userId: "user-id" }),
      { transaction: db.transaction }
    );
    expect(db.models.AdminAction.create).toHaveBeenCalledTimes(2);
  });

  it("revokes an active ban when one exists", async () => {
    const { SequelizeAdminUserAccessService } = await import("../services/admin-user-access.js");
    db.models.User.findByPk.mockResolvedValue(createUser());
    db.models.Ban.update.mockResolvedValue([1]);

    await expect(
      new SequelizeAdminUserAccessService().revokeUserBan("actor-id", "user-id")
    ).resolves.toMatchObject({ id: "user-id" });
    expect(db.models.AdminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.ban.revoke" }),
      { transaction: db.transaction }
    );
  });
});

describe("SequelizeAdminUserExportService", () => {
  it("exports personal data with session, contribution and moderation summaries", async () => {
    const { SequelizeAdminUserExportService } = await import("../services/admin-user-export.js");
    db.models.User.findByPk.mockResolvedValue(
      createUser({
        identities: [
          {
            id: "identity-id",
            provider: "google",
            providerEmail: "user@example.test",
            providerDisplayName: "User",
            providerAvatarUrl: null,
            createdAt: new Date("2026-07-01T10:00:00.000Z"),
            lastUsedAt: null
          }
        ]
      })
    );
    db.models.UserSession.findAll.mockResolvedValue([
      { expiresAt: new Date("2026-07-21T10:00:00.000Z") },
      { expiresAt: new Date("2000-01-01T10:00:00.000Z") }
    ]);
    db.models.ChangeRequest.findAll.mockResolvedValue([
      { status: "pending", count: "2" },
      { status: "approved", count: 1 }
    ]);
    db.models.ChangeRequest.findOne.mockResolvedValue({
      createdAt: new Date("2026-07-10T10:00:00.000Z")
    });
    db.models.ChangeHistory.count.mockResolvedValue(4);
    db.models.AdminAction.count.mockResolvedValue(5);
    db.models.AdminAction.findOne.mockResolvedValue({
      createdAt: new Date("2026-07-11T10:00:00.000Z")
    });

    await expect(
      new SequelizeAdminUserExportService().exportUserPersonalData("user-id")
    ).resolves.toMatchObject({
      user: { id: "user-id" },
      linkedIdentities: [{ provider: "google" }],
      sessions: { total: 2, active: 1 },
      contributions: { total: 3, pending: 2, approved: 1, rejected: 0 },
      moderationTrace: {
        changeHistoriesAsModerator: 4,
        adminActionsAsActor: 5
      }
    });
  });
});

describe("SequelizeAdminUserService", () => {
  it("blocks self service operations before touching persistence", async () => {
    const { SequelizeAdminUserService } = await import("../services/admin-users.js");
    const service = new SequelizeAdminUserService();

    await expect(service.revokeUserSessions("same-id", "same-id")).resolves.toEqual({
      status: "self"
    });
    await expect(service.unlinkUserIdentity("same-id", "same-id", "google")).resolves.toEqual({
      status: "self"
    });
    await expect(service.anonymizeUserAccount("same-id", "same-id")).resolves.toEqual({
      status: "self"
    });
    expect(db.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("revokes sessions and unlinks identities with audit entries", async () => {
    const { SequelizeAdminUserService } = await import("../services/admin-users.js");
    const service = new SequelizeAdminUserService();
    db.models.User.findByPk.mockResolvedValueOnce(createUser()).mockResolvedValueOnce(
      createUser({
        identities: [
          { id: "google-id", provider: "google" },
          { id: "twitch-id", provider: "twitch" }
        ]
      })
    );
    db.models.UserSession.destroy.mockResolvedValue(2);
    db.models.UserIdentity.destroy.mockResolvedValue(1);

    await expect(service.revokeUserSessions("actor-id", "user-id")).resolves.toEqual({
      status: "revoked",
      revokedCount: 2
    });
    await expect(service.unlinkUserIdentity("actor-id", "user-id", "google")).resolves.toEqual({
      status: "unlinked",
      provider: "google"
    });

    expect(db.models.AdminAction.create).toHaveBeenCalledTimes(2);
  });
});
