import { randomUUID } from "node:crypto";

import type { Transaction } from "sequelize";

import type { AuthProvider, RoleName } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import {
  type AdminUser,
  type BanInput,
  logAdminAction,
  serializeUser,
  userInclude
} from "./admin-shared.js";
import { SequelizeAdminUserAccessService } from "./admin-user-access.js";
import {
  type AdminUserPersonalDataExport,
  SequelizeAdminUserExportService
} from "./admin-user-export.js";

export type { AdminUserPersonalDataExport } from "./admin-user-export.js";

export type AdminUserSessionRevocationResult =
  | {
      status: "revoked";
      revokedCount: number;
    }
  | {
      status: "not_found";
    }
  | {
      status: "self";
    };

export type AdminUserIdentityUnlinkResult =
  | {
      status: "unlinked";
      provider: AuthProvider;
    }
  | {
      status: "not_found";
    }
  | {
      status: "identity_not_found";
    }
  | {
      status: "last_identity";
    }
  | {
      status: "self";
    };

export type AdminUserAnonymizationResult =
  | {
      status: "anonymized";
      user: AdminUser;
      revokedSessions: number;
      unlinkedIdentities: number;
    }
  | {
      status: "not_found";
    }
  | {
      status: "last_admin";
    }
  | {
      status: "self";
    };

export class SequelizeAdminUserService {
  readonly #access = new SequelizeAdminUserAccessService();
  readonly #exports = new SequelizeAdminUserExportService();

  async exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null> {
    return this.#exports.exportUserPersonalData(userId);
  }

  async revokeUserSessions(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserSessionRevocationResult> {
    if (actorUserId === userId) {
      return { status: "self" };
    }

    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, {
        attributes: ["id"],
        transaction
      });

      if (!user) {
        return { status: "not_found" as const };
      }

      const revokedCount = await models.UserSession.destroy({
        where: sequelize.where(sequelize.literal("\"data\"->>'userId'"), userId),
        transaction
      });

      await logAdminAction(
        actorUserId,
        {
          action: "user.sessions.revoke",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: {
            revokedCount
          }
        },
        transaction
      );

      return {
        status: "revoked" as const,
        revokedCount
      };
    });
  }

  async unlinkUserIdentity(
    actorUserId: string,
    userId: string,
    provider: AuthProvider
  ): Promise<AdminUserIdentityUnlinkResult> {
    if (actorUserId === userId) {
      return { status: "self" };
    }

    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, {
        include: [
          {
            association: "identities",
            attributes: ["id", "provider"],
            required: false
          }
        ],
        transaction
      });

      if (!user) {
        return { status: "not_found" as const };
      }

      const identities = user.identities ?? [];
      const identity = identities.find((entry) => entry.provider === provider);

      if (!identity) {
        return { status: "identity_not_found" as const };
      }

      if (identities.length <= 1) {
        return { status: "last_identity" as const };
      }

      await models.UserIdentity.destroy({
        where: {
          id: identity.id,
          userId: user.id
        },
        transaction
      });

      await logAdminAction(
        actorUserId,
        {
          action: "user.identity.unlink",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: {
            provider
          }
        },
        transaction
      );

      return {
        status: "unlinked" as const,
        provider
      };
    });
  }

  async anonymizeUserAccount(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserAnonymizationResult> {
    if (actorUserId === userId) {
      return { status: "self" };
    }

    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, {
        include: [
          ...userInclude,
          {
            association: "identities",
            attributes: ["id"],
            required: false
          }
        ],
        transaction
      });
      const defaultRole = await models.Role.findOne({ where: { name: "user" }, transaction });

      if (!user || !defaultRole) {
        return { status: "not_found" as const };
      }

      if (user.role?.name === "administrator") {
        const adminCount = await models.User.count({
          include: [{ model: models.Role, as: "role", where: { name: "administrator" } }],
          transaction
        });

        if (adminCount <= 1) {
          return { status: "last_admin" as const };
        }
      }

      const unlinkedIdentities = await models.UserIdentity.destroy({
        where: { userId: user.id },
        transaction
      });
      const revokedSessions = await models.UserSession.destroy({
        where: sequelize.where(sequelize.literal("\"data\"->>'userId'"), user.id),
        transaction
      });
      const anonymizedEmail = `deleted-${randomUUID()}@deleted.local`;

      await user.update(
        {
          email: anonymizedEmail,
          displayName: "Utilisateur supprimé",
          displayNameChosenAt: new Date(),
          avatarUrl: null,
          roleId: defaultRole.id,
          lastLoginAt: null
        },
        { transaction }
      );

      await logAdminAction(
        actorUserId,
        {
          action: "user.account.anonymize",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: {
            unlinkedIdentities,
            revokedSessions
          }
        },
        transaction
      );

      const reloadedUser = await this.reloadUser(user.id, transaction);

      if (!reloadedUser) {
        return { status: "not_found" as const };
      }

      return {
        status: "anonymized" as const,
        user: reloadedUser,
        revokedSessions,
        unlinkedIdentities
      };
    });
  }

  async updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null> {
    return this.#access.updateUserRole(actorUserId, userId, roleName);
  }

  async banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null> {
    return this.#access.banUser(actorUserId, userId, input);
  }

  async revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null> {
    return this.#access.revokeUserBan(actorUserId, userId);
  }

  private async reloadUser(userId: string, transaction: Transaction) {
    const user = await models.User.findByPk(userId, {
      include: userInclude,
      transaction
    });

    return user ? serializeUser(user) : null;
  }
}
