import { Op } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  roleFindOne: vi.fn(),
  userIdentityFindOne: vi.fn(),
  userFindOne: vi.fn(),
  userFindByPk: vi.fn(),
  userCount: vi.fn(),
  userCreate: vi.fn(),
  userIdentityCreate: vi.fn(),
  userIdentityDestroy: vi.fn(),
  userIdentityUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Role: {
      findOne: mockState.roleFindOne
    },
    UserIdentity: {
      create: mockState.userIdentityCreate,
      destroy: mockState.userIdentityDestroy,
      findOne: mockState.userIdentityFindOne,
      upsert: mockState.userIdentityUpsert
    },
    User: {
      findOne: mockState.userFindOne,
      findByPk: mockState.userFindByPk,
      count: mockState.userCount,
      create: mockState.userCreate
    }
  },
  sequelize: {
    transaction: mockState.transaction
  }
}));

import {
  type AuthenticatedUser,
  type ExternalIdentity,
  SequelizeAuthService
} from "../services/auth.js";

const identity: ExternalIdentity = {
  provider: "google",
  providerUserId: "provider-user-1",
  email: "viewer@example.test",
  displayName: "Viewer Example",
  avatarUrl: null
};

const authenticatedUser = (roleName: "administrator" | "user"): AuthenticatedUser => ({
  id: "user-1",
  email: identity.email,
  displayName: "Utilisateur test",
  mustChooseDisplayName: true,
  avatarUrl: null,
  role: {
    id: roleName === "administrator" ? "role-admin" : "role-user",
    name: roleName
  },
  isBanned: false,
  linkedIdentities: []
});

describe("SequelizeAuthService", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    mockState.transaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mockState.roleFindOne.mockImplementation(async ({ where }: { where: { name: string } }) => {
      if (where.name === "user") {
        return { id: "role-user", name: "user" };
      }

      if (where.name === "administrator") {
        return { id: "role-admin", name: "administrator" };
      }

      return null;
    });
    mockState.userIdentityFindOne.mockResolvedValue(null);
    mockState.userIdentityCreate.mockResolvedValue(undefined);
    mockState.userIdentityDestroy.mockResolvedValue(1);
    mockState.userFindOne.mockResolvedValue(null);
    mockState.userIdentityUpsert.mockResolvedValue(undefined);
    mockState.userCreate.mockImplementation(async (payload: Record<string, unknown>) => ({
      id: "user-1",
      ...payload
    }));
  });

  it("promotes the first non-seed user to administrator", async () => {
    mockState.userCount.mockResolvedValue(0);

    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("administrator"));

    const result = await service.authenticateIdentity(identity);

    expect(mockState.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: identity.email,
        roleId: "role-admin"
      }),
      expect.anything()
    );
    expect(result).toEqual({
      status: "authenticated",
      user: authenticatedUser("administrator")
    });
  });

  it("keeps later non-seed users on the regular user role", async () => {
    mockState.userCount.mockResolvedValue(1);

    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));

    const result = await service.authenticateIdentity(identity);

    expect(mockState.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: identity.email,
        roleId: "role-user"
      }),
      expect.anything()
    );
    expect(result).toEqual({
      status: "authenticated",
      user: authenticatedUser("user")
    });
  });

  it("updates an existing identity owner and preserves the account", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mockState.userIdentityFindOne.mockResolvedValue({ userId: "existing-user" });
    mockState.userFindByPk.mockResolvedValue({
      id: "existing-user",
      email: "old@example.test",
      avatarUrl: "old-avatar",
      update
    });
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));

    await expect(service.authenticateIdentity(identity)).resolves.toEqual({
      status: "authenticated",
      user: authenticatedUser("user")
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: identity.email,
        avatarUrl: null,
        lastLoginAt: expect.any(Date)
      }),
      expect.anything()
    );
    expect(mockState.userCreate).not.toHaveBeenCalled();
    expect(mockState.userIdentityUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "existing-user", provider: "google" }),
      expect.anything()
    );
  });

  it("reports an email conflict instead of linking accounts implicitly", async () => {
    mockState.userFindOne.mockResolvedValue({ id: "email-owner" });
    const service = new SequelizeAuthService();
    const getSessionUser = vi.spyOn(service, "getSessionUser").mockResolvedValue(null);

    await expect(service.authenticateIdentity(identity)).resolves.toEqual({
      status: "email_in_use"
    });
    expect(getSessionUser).toHaveBeenCalledWith("email-owner");
    expect(mockState.userCreate).not.toHaveBeenCalled();
    expect(mockState.userIdentityUpsert).not.toHaveBeenCalled();
  });

  it("returns the banned authentication status", async () => {
    mockState.userCount.mockResolvedValue(1);
    const bannedUser = { ...authenticatedUser("user"), isBanned: true };
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(bannedUser);

    await expect(service.authenticateIdentity(identity)).resolves.toEqual({
      status: "banned",
      user: bannedUser
    });
  });

  it("fails explicitly when a required role is missing", async () => {
    mockState.roleFindOne.mockResolvedValue(null);

    await expect(new SequelizeAuthService().authenticateIdentity(identity)).rejects.toMatchObject({
      status: 500,
      code: "AUTH_DEFAULT_ROLE_MISSING",
      details: { role: "user" }
    });

    mockState.roleFindOne.mockImplementation(async ({ where }: { where: { name: string } }) =>
      where.name === "user" ? { id: "role-user", name: "user" } : null
    );
    await expect(new SequelizeAuthService().authenticateIdentity(identity)).rejects.toMatchObject({
      status: 500,
      code: "AUTH_ADMIN_ROLE_MISSING",
      details: { role: "administrator" }
    });
  });

  it("links a new provider identity to the current user", async () => {
    mockState.userFindByPk.mockResolvedValue({ id: "user-1", identities: [] });
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));

    await expect(service.linkIdentity("user-1", identity)).resolves.toEqual({
      status: "linked",
      user: authenticatedUser("user")
    });
    expect(mockState.userIdentityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", providerUserId: identity.providerUserId }),
      expect.anything()
    );
  });

  it("returns null when a linked identity cannot be reloaded", async () => {
    mockState.userFindByPk.mockResolvedValue({ id: "user-1", identities: [] });
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(null);

    await expect(service.linkIdentity("user-1", identity)).resolves.toBeNull();
  });

  it("recognizes an identity already linked to the current user", async () => {
    mockState.userFindByPk.mockResolvedValue({
      id: "user-1",
      identities: [{ provider: "google", providerUserId: identity.providerUserId }]
    });
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));

    await expect(service.linkIdentity("user-1", identity)).resolves.toEqual({
      status: "already_linked",
      user: authenticatedUser("user")
    });
    expect(mockState.userIdentityCreate).not.toHaveBeenCalled();
  });

  it("rejects a different identity from an already linked provider", async () => {
    mockState.userFindByPk.mockResolvedValue({
      id: "user-1",
      identities: [{ provider: "google", providerUserId: "another-google-account" }]
    });

    await expect(new SequelizeAuthService().linkIdentity("user-1", identity)).resolves.toEqual({
      status: "different_identity_already_linked"
    });
  });

  it("rejects identities and emails belonging to another account", async () => {
    mockState.userFindByPk.mockResolvedValue({ id: "user-1", identities: [] });
    mockState.userIdentityFindOne.mockResolvedValueOnce({ userId: "other-user" });
    const service = new SequelizeAuthService();

    await expect(service.linkIdentity("user-1", identity)).resolves.toEqual({
      status: "linked_to_other_user"
    });

    mockState.userIdentityFindOne.mockResolvedValueOnce(null);
    mockState.userFindOne.mockResolvedValueOnce({ id: "other-user" });
    await expect(service.linkIdentity("user-1", identity)).resolves.toEqual({
      status: "linked_to_other_user"
    });
  });

  it("protects the last identity and removes an additional identity", async () => {
    mockState.userFindByPk.mockResolvedValueOnce({
      id: "user-1",
      identities: [{ id: "identity-google", provider: "google" }]
    });
    const service = new SequelizeAuthService();
    await expect(service.unlinkIdentity("user-1", "google")).resolves.toBe("last_identity");

    mockState.userFindByPk.mockResolvedValueOnce({
      id: "user-1",
      identities: [
        { id: "identity-google", provider: "google" },
        { id: "identity-discord", provider: "discord" }
      ]
    });
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));
    await expect(service.unlinkIdentity("user-1", "discord")).resolves.toEqual(
      authenticatedUser("user")
    );
    expect(mockState.userIdentityDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "identity-discord", userId: "user-1" } })
    );
  });

  it("returns null for missing users or unlinked providers", async () => {
    mockState.userFindByPk.mockResolvedValueOnce(null);
    await expect(new SequelizeAuthService().linkIdentity("missing", identity)).resolves.toBeNull();

    mockState.userFindByPk.mockResolvedValueOnce(null);
    await expect(
      new SequelizeAuthService().unlinkIdentity("missing", "discord")
    ).resolves.toBeNull();

    mockState.userFindByPk.mockResolvedValueOnce({ id: "user-1", identities: [] });
    await expect(
      new SequelizeAuthService().unlinkIdentity("user-1", "discord")
    ).resolves.toBeNull();
  });

  it("serializes the private session user and linked identities", async () => {
    mockState.userFindByPk.mockResolvedValue({
      id: "user-1",
      email: "private@example.test",
      displayName: "Nom public",
      displayNameChosenAt: new Date("2026-07-01T10:00:00.000Z"),
      avatarUrl: null,
      role: { id: "role-user", name: "user" },
      bans: [{ id: "ban-1" }],
      identities: [
        {
          id: "identity-google",
          provider: "google",
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          lastUsedAt: new Date("2026-07-01T09:00:00.000Z")
        },
        {
          id: "identity-discord",
          provider: "discord",
          createdAt: new Date("2026-06-02T10:00:00.000Z"),
          lastUsedAt: null
        }
      ]
    });

    await expect(new SequelizeAuthService().getSessionUser("user-1")).resolves.toEqual({
      id: "user-1",
      email: "private@example.test",
      displayName: "Nom public",
      mustChooseDisplayName: false,
      avatarUrl: null,
      role: { id: "role-user", name: "user" },
      isBanned: true,
      linkedIdentities: [
        {
          id: "identity-google",
          provider: "google",
          connectedAt: "2026-06-01T10:00:00.000Z",
          lastUsedAt: "2026-07-01T09:00:00.000Z",
          canUnlink: true
        },
        {
          id: "identity-discord",
          provider: "discord",
          connectedAt: "2026-06-02T10:00:00.000Z",
          lastUsedAt: null,
          canUnlink: true
        }
      ]
    });
  });

  it("builds the active ban filter with the current request time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00.000Z"));
    mockState.userFindByPk.mockResolvedValueOnce(null);

    await expect(new SequelizeAuthService().getSessionUser("user-1")).resolves.toBeNull();

    const findOptions = mockState.userFindByPk.mock.calls[0]?.[1] as
      | {
          include?: Array<{ association?: string; where?: Record<PropertyKey, unknown> }>;
        }
      | undefined;
    const banInclude = findOptions?.include?.find((entry) => entry.association === "bans");
    const banWindow = banInclude?.where?.[Op.or] as
      | Array<{ expiresAt: null } | { expiresAt: Record<PropertyKey, Date> }>
      | undefined;
    const expiringBanFilter = banWindow?.find(
      (entry): entry is { expiresAt: Record<PropertyKey, Date> } => entry.expiresAt !== null
    );

    expect(expiringBanFilter?.expiresAt[Op.gt]).toEqual(new Date("2026-07-30T12:00:00.000Z"));
  });

  it("rejects session users without a loaded role", async () => {
    mockState.userFindByPk.mockResolvedValue({
      id: "user-1",
      email: identity.email,
      displayName: "Nom public",
      displayNameChosenAt: null,
      avatarUrl: null,
      role: null
    });

    await expect(new SequelizeAuthService().getSessionUser("user-1")).rejects.toMatchObject({
      status: 500,
      code: "AUTH_USER_ROLE_MISSING",
      details: { userId: "user-1" }
    });

    mockState.userFindByPk.mockResolvedValueOnce(null);
    await expect(new SequelizeAuthService().getSessionUser("missing")).resolves.toBeNull();
  });

  it("updates the public display name and marks it as chosen", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mockState.userFindByPk.mockResolvedValue({ id: "user-1", update });
    const service = new SequelizeAuthService();
    vi.spyOn(service, "getSessionUser").mockResolvedValue(authenticatedUser("user"));

    await expect(service.updateDisplayName("user-1", "Nouveau nom")).resolves.toEqual(
      authenticatedUser("user")
    );
    expect(update).toHaveBeenCalledWith({
      displayName: "Nouveau nom",
      displayNameChosenAt: expect.any(Date)
    });

    mockState.userFindByPk.mockResolvedValueOnce(null);
    await expect(service.updateDisplayName("missing", "Nouveau nom")).resolves.toBeNull();
  });

  it("exports personal account and identity data", async () => {
    mockState.userFindByPk.mockResolvedValue({
      id: "user-1",
      email: "private@example.test",
      displayName: "Nom public",
      displayNameChosenAt: new Date("2026-07-01T10:00:00.000Z"),
      avatarUrl: "https://avatar.example/image.png",
      role: { id: "role-user", name: "user" },
      bans: [],
      lastLoginAt: null,
      createdAt: new Date("2026-06-01T08:00:00.000Z"),
      updatedAt: new Date("2026-07-01T10:00:00.000Z"),
      identities: [
        {
          id: "identity-google",
          provider: "google",
          providerEmail: "provider@example.test",
          providerDisplayName: "Provider name",
          providerAvatarUrl: null,
          createdAt: new Date("2026-06-01T08:00:00.000Z"),
          lastUsedAt: null
        }
      ]
    });

    const result = await new SequelizeAuthService().exportPersonalData("user-1");

    expect(result?.exportedAt).toEqual(expect.any(String));
    expect(result?.account).toEqual({
      id: "user-1",
      email: "private@example.test",
      displayName: "Nom public",
      displayNameChosenAt: "2026-07-01T10:00:00.000Z",
      avatarUrl: "https://avatar.example/image.png",
      role: "user",
      isBanned: false,
      lastLoginAt: null,
      createdAt: "2026-06-01T08:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z"
    });
    expect(result?.linkedIdentities).toEqual([
      {
        id: "identity-google",
        provider: "google",
        providerEmail: "provider@example.test",
        providerDisplayName: "Provider name",
        providerAvatarUrl: null,
        connectedAt: "2026-06-01T08:00:00.000Z",
        lastUsedAt: null
      }
    ]);
  });

  it("returns null when personal data cannot be associated with a role", async () => {
    mockState.userFindByPk.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: null });
    const service = new SequelizeAuthService();

    await expect(service.exportPersonalData("missing")).resolves.toBeNull();
    await expect(service.exportPersonalData("without-role")).resolves.toBeNull();
  });
});
