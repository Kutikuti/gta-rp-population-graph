import { randomUUID } from "node:crypto";

import { Op } from "sequelize";

import type { AuthProvider, RoleName } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  mustChooseDisplayName: boolean;
  avatarUrl: string | null;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  linkedIdentities: Array<{
    id: string;
    provider: AuthProvider;
    connectedAt: string;
    lastUsedAt: string | null;
    canUnlink: boolean;
  }>;
};

export type ExternalIdentity = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AuthResult =
  | {
      status: "authenticated";
      user: AuthenticatedUser;
    }
  | {
      status: "banned";
      user: AuthenticatedUser;
    }
  | {
      status: "email_in_use";
    };

export type LinkIdentityResult =
  | {
      status: "linked";
      user: AuthenticatedUser;
    }
  | {
      status: "already_linked";
      user: AuthenticatedUser;
    }
  | {
      status: "linked_to_other_user";
    }
  | {
      status: "different_identity_already_linked";
    };

export interface AuthService {
  getSessionUser(userId: string): Promise<AuthenticatedUser | null>;
  authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult>;
  linkIdentity(userId: string, identity: ExternalIdentity): Promise<LinkIdentityResult | null>;
  updateDisplayName(userId: string, displayName: string): Promise<AuthenticatedUser | null>;
  unlinkIdentity(
    userId: string,
    provider: AuthProvider
  ): Promise<AuthenticatedUser | "last_identity" | null>;
}

const activeBanWhere = {
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
};

const serializeAuthenticatedUser = (user: {
  id: string;
  email: string;
  displayName: string;
  displayNameChosenAt: Date | null;
  avatarUrl: string | null;
  role?: { id: string; name: RoleName } | null;
  bans?: Array<{ id: string }>;
  identities?: Array<{
    id: string;
    provider: AuthProvider;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
}): AuthenticatedUser => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    mustChooseDisplayName: !user.displayNameChosenAt,
    avatarUrl: user.avatarUrl,
    role: {
      id: user.role.id,
      name: user.role.name
    },
    isBanned: Boolean(user.bans?.length),
    linkedIdentities: (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      connectedAt: identity.createdAt.toISOString(),
      lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null,
      canUnlink: (user.identities?.length ?? 0) > 1
    }))
  };
};

const createDefaultDisplayName = () => `Utilisateur ${randomUUID().slice(0, 8)}`;

export class SequelizeAuthService implements AuthService {
  async getSessionUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await models.User.findByPk(userId, {
      include: [
        { association: "role", attributes: ["id", "name"] },
        {
          association: "bans",
          attributes: ["id"],
          required: false,
          where: activeBanWhere
        },
        {
          association: "identities",
          attributes: ["id", "provider", "createdAt", "lastUsedAt"],
          required: false
        }
      ]
    });

    if (!user) {
      return null;
    }

    return serializeAuthenticatedUser(user);
  }

  async authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult> {
    const defaultRole = await models.Role.findOne({
      where: { name: "user" },
      attributes: ["id", "name"]
    });

    if (!defaultRole) {
      throw new Error('Role "user" is missing from the database.');
    }

    const now = new Date();
    let userId = "";

    await sequelize.transaction(async (transaction) => {
      const existingIdentity = await models.UserIdentity.findOne({
        where: {
          provider: identity.provider,
          providerUserId: identity.providerUserId
        },
        transaction
      });

      let user = existingIdentity
        ? await models.User.findByPk(existingIdentity.userId, { transaction })
        : null;

      if (!user) {
        const existingUserWithEmail = await models.User.findOne({
          where: { email: identity.email },
          attributes: ["id"],
          transaction
        });

        if (existingUserWithEmail) {
          userId = existingUserWithEmail.id;
          return;
        }
      }

      if (!user) {
        user = await models.User.create(
          {
            email: identity.email,
            displayName: createDefaultDisplayName(),
            displayNameChosenAt: null,
            avatarUrl: identity.avatarUrl,
            roleId: defaultRole.id,
            lastLoginAt: now
          },
          { transaction }
        );
      } else {
        const updates: Partial<{
          email: string;
          avatarUrl: string | null;
          lastLoginAt: Date;
        }> = {
          lastLoginAt: now
        };

        if (user.email !== identity.email) {
          updates.email = identity.email;
        }

        if (user.avatarUrl !== identity.avatarUrl) {
          updates.avatarUrl = identity.avatarUrl;
        }

        await user.update(updates, { transaction });
      }

      await models.UserIdentity.upsert(
        {
          userId: user.id,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
          providerDisplayName: identity.displayName,
          providerAvatarUrl: identity.avatarUrl,
          lastUsedAt: now
        },
        { transaction }
      );

      userId = user.id;
    });

    const authenticatedUser = await this.getSessionUser(userId);

    if (!authenticatedUser) {
      return {
        status: "email_in_use"
      };
    }

    return authenticatedUser.isBanned
      ? { status: "banned", user: authenticatedUser }
      : { status: "authenticated", user: authenticatedUser };
  }

  async linkIdentity(
    userId: string,
    identity: ExternalIdentity
  ): Promise<LinkIdentityResult | null> {
    const outcome = await sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, {
        include: [
          {
            association: "identities",
            attributes: ["id", "provider", "providerUserId"],
            required: false
          }
        ],
        transaction
      });

      if (!user) {
        return null;
      }

      const alreadyLinkedToCurrentUser = (user.identities ?? []).find(
        (entry) => entry.provider === identity.provider
      );

      if (alreadyLinkedToCurrentUser) {
        if (alreadyLinkedToCurrentUser.providerUserId !== identity.providerUserId) {
          return {
            status: "different_identity_already_linked" as const
          };
        }

        return {
          status: "already_linked" as const,
          userId: user.id
        };
      }

      const existingIdentity = await models.UserIdentity.findOne({
        where: {
          provider: identity.provider,
          providerUserId: identity.providerUserId
        },
        transaction
      });

      if (existingIdentity) {
        return {
          status: "linked_to_other_user" as const
        };
      }

      const userWithProviderEmail = await models.User.findOne({
        where: { email: identity.email },
        attributes: ["id"],
        transaction
      });

      if (userWithProviderEmail && userWithProviderEmail.id !== user.id) {
        return {
          status: "linked_to_other_user" as const
        };
      }

      await models.UserIdentity.create(
        {
          userId: user.id,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
          providerDisplayName: identity.displayName,
          providerAvatarUrl: identity.avatarUrl,
          lastUsedAt: new Date()
        },
        { transaction }
      );

      return {
        status: "linked" as const,
        userId: user.id
      };
    });

    if (!outcome) {
      return null;
    }

    if (
      outcome.status === "linked_to_other_user" ||
      outcome.status === "different_identity_already_linked"
    ) {
      return outcome;
    }

    const authenticatedUser = await this.getSessionUser(String(outcome.userId));

    if (!authenticatedUser) {
      return null;
    }

    return {
      status: outcome.status,
      user: authenticatedUser
    };
  }

  async updateDisplayName(userId: string, displayName: string): Promise<AuthenticatedUser | null> {
    const user = await models.User.findByPk(userId);

    if (!user) {
      return null;
    }

    await user.update({
      displayName,
      displayNameChosenAt: new Date()
    });

    return this.getSessionUser(user.id);
  }

  async unlinkIdentity(
    userId: string,
    provider: AuthProvider
  ): Promise<AuthenticatedUser | "last_identity" | null> {
    const result: string | "last_identity" | null = await sequelize.transaction(
      async (transaction) => {
        const user = await models.User.findByPk(userId, {
          include: [
            {
              association: "identities",
              attributes: ["id", "provider", "providerUserId"],
              required: false
            }
          ],
          transaction
        });

        if (!user) {
          return null;
        }

        const identities = user.identities ?? [];
        const identity = identities.find((entry) => entry.provider === provider);

        if (!identity) {
          return null;
        }

        if (identities.length <= 1) {
          return "last_identity" as const;
        }

        await models.UserIdentity.destroy({
          where: {
            id: identity.id,
            userId: user.id
          },
          transaction
        });

        return String(user.id);
      }
    );

    if (result === null || result === "last_identity") {
      return result;
    }

    return this.getSessionUser(result);
  }
}
