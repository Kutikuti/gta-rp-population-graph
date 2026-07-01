import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  roleFindOne: vi.fn(),
  userIdentityFindOne: vi.fn(),
  userFindOne: vi.fn(),
  userFindByPk: vi.fn(),
  userCount: vi.fn(),
  userCreate: vi.fn(),
  userIdentityUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Role: {
      findOne: mockState.roleFindOne
    },
    UserIdentity: {
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
});
