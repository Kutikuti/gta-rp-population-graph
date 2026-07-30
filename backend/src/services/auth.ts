import { randomUUID } from "node:crypto";

import { Op } from "sequelize";

import type { AuthProvider } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import { internalServerError } from "../middleware/api-error.js";
import {
  activeBanWhere,
  serializeAuthenticatedUser,
  serializePersonalDataExport
} from "./auth-serializers.js";
import type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity,
  LinkIdentityResult,
  PersonalDataExport
} from "./auth-types.js";

export type {
  AuthenticatedUser,
  AuthResult,
  AuthService,
  ExternalIdentity,
  LinkIdentityResult,
  PersonalDataExport
} from "./auth-types.js";

const createDefaultDisplayName = () => `Utilisateur ${randomUUID().slice(0, 8)}`;
const seedEmailSuffix = ".seed@example.test";

export class SequelizeAuthService implements AuthService {
  async getSessionUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await models.User.findByPk(userId, {
      include: [
        { association: "role", attributes: ["id", "name"] },
        {
          association: "bans",
          attributes: ["id"],
          required: false,
          where: activeBanWhere()
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
    const [defaultRole, administratorRole] = await Promise.all([
      models.Role.findOne({
        where: { name: "user" },
        attributes: ["id", "name"]
      }),
      models.Role.findOne({
        where: { name: "administrator" },
        attributes: ["id", "name"]
      })
    ]);

    if (!defaultRole) {
      throw internalServerError(
        "AUTH_DEFAULT_ROLE_MISSING",
        "Le role utilisateur par defaut est absent.",
        {
          role: "user"
        }
      );
    }

    if (!administratorRole) {
      throw internalServerError("AUTH_ADMIN_ROLE_MISSING", "Le role administrateur est absent.", {
        role: "administrator"
      });
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
        const nonSeedUserCount = await models.User.count({
          where: {
            email: {
              [Op.notLike]: `%${seedEmailSuffix}`
            }
          },
          transaction
        });

        user = await models.User.create(
          {
            email: identity.email,
            displayName: createDefaultDisplayName(),
            displayNameChosenAt: null,
            avatarUrl: identity.avatarUrl,
            roleId: nonSeedUserCount === 0 ? administratorRole.id : defaultRole.id,
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

  async exportPersonalData(userId: string): Promise<PersonalDataExport | null> {
    const user = await models.User.findByPk(userId, {
      include: [
        {
          association: "role",
          attributes: ["id", "name"]
        },
        {
          association: "bans",
          attributes: ["id"],
          required: false,
          where: activeBanWhere()
        },
        {
          association: "identities",
          attributes: [
            "id",
            "provider",
            "providerEmail",
            "providerDisplayName",
            "providerAvatarUrl",
            "createdAt",
            "lastUsedAt"
          ],
          required: false,
          order: [["createdAt", "ASC"]]
        }
      ]
    });

    if (!user?.role) {
      return null;
    }

    return serializePersonalDataExport(user);
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
