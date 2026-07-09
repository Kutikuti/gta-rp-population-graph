import { randomUUID } from "node:crypto";

import type { Transaction } from "sequelize";

import {
  type AuthProvider,
  type ChangeRequestStatus,
  type RoleName,
  roleNames,
  tagTypes
} from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import {
  type AdminNotionImportApplyResult,
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportPhotoResult,
  SequelizeAdminNotionImportService
} from "./admin-notion-imports.js";
import {
  type AdminDashboard,
  type AdminTag,
  type AdminUser,
  activeBanWhere,
  adminActionInclude,
  type BanInput,
  logAdminAction,
  serializeAdminAction,
  serializeTag,
  serializeUser,
  type TagInput,
  userInclude
} from "./admin-shared.js";

export type { AdminNotionImportBatch, AdminNotionImportDetail } from "./admin-notion-imports.js";
export type AdminNotionImportEntry = AdminNotionImportDetail["entries"][number];
export type { AdminNotionImportPhotoResult } from "./admin-notion-imports-shared.js";

export type AdminUserPersonalDataExport = {
  exportedAt: string;
  user: AdminUser;
  linkedIdentities: Array<{
    id: string;
    provider: "google" | "discord" | "twitch";
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
    lastUsedAt: string | null;
  }>;
  sessions: {
    total: number;
    active: number;
    latestExpiryAt: string | null;
  };
  contributions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    latestRequestAt: string | null;
  };
  moderationTrace: {
    changeHistoriesAsModerator: number;
    adminActionsAsActor: number;
    latestAdminActionAt: string | null;
  };
};

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

export type {
  AdminActionEntry,
  AdminDashboard,
  AdminTag,
  AdminUser,
  BanInput,
  TagInput
} from "./admin-shared.js";

type ContributionCountRow = {
  status: ChangeRequestStatus;
  count: string | number;
};

export type AdminService = {
  getDashboard(): Promise<AdminDashboard>;
  exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null>;
  revokeUserSessions(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserSessionRevocationResult>;
  unlinkUserIdentity(
    actorUserId: string,
    userId: string,
    provider: AuthProvider
  ): Promise<AdminUserIdentityUnlinkResult>;
  anonymizeUserAccount(actorUserId: string, userId: string): Promise<AdminUserAnonymizationResult>;
  listNotionImports(): Promise<AdminNotionImportBatch[]>;
  getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null>;
  applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportApplyResult>;
  importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportPhotoResult>;
  createTag(actorUserId: string, input: TagInput): Promise<AdminTag>;
  updateTag(actorUserId: string, tagId: string, input: TagInput): Promise<AdminTag | null>;
  deleteTag(actorUserId: string, tagId: string): Promise<"deleted" | "in_use" | "not_found">;
  updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null>;
  banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null>;
  revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null>;
};

export class SequelizeAdminService implements AdminService {
  readonly #notionImports = new SequelizeAdminNotionImportService();

  async getDashboard(): Promise<AdminDashboard> {
    const [users, tags, actions] = await Promise.all([
      models.User.findAll({
        include: userInclude,
        order: [["createdAt", "DESC"]]
      }),
      this.listTagsWithUsage(),
      models.AdminAction.findAll({
        include: adminActionInclude,
        order: [["createdAt", "DESC"]],
        limit: 50
      })
    ]);

    return {
      users: users.map(serializeUser),
      tags,
      actions: actions.map(serializeAdminAction)
    };
  }

  async exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null> {
    const [user, sessions, contributionCounts, latestRequest, moderationCounts, latestAdminAction] =
      await Promise.all([
        models.User.findByPk(userId, {
          include: [
            { model: models.Role, as: "role" },
            { model: models.Ban, as: "bans", required: false, where: activeBanWhere },
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
              required: false
            }
          ]
        }),
        models.UserSession.findAll({
          attributes: ["expiresAt"],
          where: sequelize.where(sequelize.literal("\"data\"->>'userId'"), userId)
        }),
        models.ChangeRequest.findAll({
          attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
          where: { userId },
          group: ["status"],
          raw: true
        }) as unknown as Promise<ContributionCountRow[]>,
        models.ChangeRequest.findOne({
          attributes: ["createdAt"],
          where: { userId },
          order: [["createdAt", "DESC"]]
        }),
        Promise.all([
          models.ChangeHistory.count({ where: { moderatorId: userId } }),
          models.AdminAction.count({ where: { actorUserId: userId } })
        ]),
        models.AdminAction.findOne({
          attributes: ["createdAt"],
          where: { actorUserId: userId },
          order: [["createdAt", "DESC"]]
        })
      ]);

    if (!user) {
      return null;
    }

    const now = Date.now();
    const latestExpiryAt = sessions.reduce<string | null>((latest, session) => {
      const current = session.expiresAt.toISOString();
      return !latest || current > latest ? current : latest;
    }, null);
    const activeSessions = sessions.filter((session) => session.expiresAt.getTime() > now).length;
    const contributionSummary = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    for (const row of contributionCounts) {
      const status = row.status;
      const count = Number(row.count);

      if (status === "pending" || status === "approved" || status === "rejected") {
        contributionSummary[status] = count;
      }
    }

    const [changeHistoriesAsModerator, adminActionsAsActor] = moderationCounts;

    return {
      exportedAt: new Date().toISOString(),
      user: serializeUser(user),
      linkedIdentities: (user.identities ?? []).map((identity) => ({
        id: identity.id,
        provider: identity.provider,
        providerEmail: identity.providerEmail,
        providerDisplayName: identity.providerDisplayName,
        providerAvatarUrl: identity.providerAvatarUrl,
        connectedAt: identity.createdAt.toISOString(),
        lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null
      })),
      sessions: {
        total: sessions.length,
        active: activeSessions,
        latestExpiryAt
      },
      contributions: {
        total:
          contributionSummary.pending + contributionSummary.approved + contributionSummary.rejected,
        pending: contributionSummary.pending,
        approved: contributionSummary.approved,
        rejected: contributionSummary.rejected,
        latestRequestAt: latestRequest?.createdAt ? latestRequest.createdAt.toISOString() : null
      },
      moderationTrace: {
        changeHistoriesAsModerator,
        adminActionsAsActor,
        latestAdminActionAt: latestAdminAction?.createdAt
          ? latestAdminAction.createdAt.toISOString()
          : null
      }
    };
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
      const [user, defaultRole] = await Promise.all([
        models.User.findByPk(userId, {
          include: [
            ...userInclude,
            {
              association: "identities",
              attributes: ["id"],
              required: false
            }
          ],
          transaction
        }),
        models.Role.findOne({ where: { name: "user" }, transaction })
      ]);

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

  async listNotionImports(): Promise<AdminNotionImportBatch[]> {
    return this.#notionImports.listNotionImports();
  }

  async getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null> {
    return this.#notionImports.getNotionImportDetail(batchId);
  }

  async applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportApplyResult> {
    return this.#notionImports.applyNotionImportEntry(input);
  }

  async importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportPhotoResult> {
    return this.#notionImports.importNotionImportEntryPhoto(input);
  }

  async createTag(actorUserId: string, input: TagInput): Promise<AdminTag> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.create(input, { transaction });
      await logAdminAction(
        actorUserId,
        {
          action: "tag.create",
          targetType: "tag",
          targetId: tag.id,
          changes: { new: input }
        },
        transaction
      );

      return serializeTag(tag, 0);
    });
  }

  async updateTag(actorUserId: string, tagId: string, input: TagInput): Promise<AdminTag | null> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.findByPk(tagId, { transaction });

      if (!tag) {
        return null;
      }

      const old = serializeTag(tag);
      await tag.update(input, { transaction });
      await logAdminAction(
        actorUserId,
        {
          action: "tag.update",
          targetType: "tag",
          targetId: tag.id,
          changes: { old, new: serializeTag(tag) }
        },
        transaction
      );

      return serializeTag(tag, await this.countTagUsage(tag.id, transaction));
    });
  }

  async deleteTag(actorUserId: string, tagId: string): Promise<"deleted" | "in_use" | "not_found"> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.findByPk(tagId, { transaction });

      if (!tag) {
        return "not_found";
      }

      const usageCount = await this.countTagUsage(tag.id, transaction);

      if (usageCount > 0) {
        return "in_use";
      }

      const old = serializeTag(tag, usageCount);
      await tag.destroy({ transaction });
      await logAdminAction(
        actorUserId,
        {
          action: "tag.delete",
          targetType: "tag",
          targetId: tag.id,
          changes: { old }
        },
        transaction
      );

      return "deleted";
    });
  }

  async updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null> {
    return sequelize.transaction(async (transaction) => {
      const [user, nextRole] = await Promise.all([
        models.User.findByPk(userId, {
          include: userInclude,
          transaction
        }),
        models.Role.findOne({ where: { name: roleName }, transaction })
      ]);

      if (!user || !nextRole) {
        return null;
      }

      if (user.role?.name === "administrator" && roleName !== "administrator") {
        const adminCount = await models.User.count({
          include: [{ model: models.Role, as: "role", where: { name: "administrator" } }],
          transaction
        });

        if (adminCount <= 1) {
          return "last_admin";
        }
      }

      const oldRole = user.role?.name ?? null;
      await user.update({ roleId: nextRole.id }, { transaction });
      await logAdminAction(
        actorUserId,
        {
          action: "user.role.update",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { role: { old: oldRole, new: roleName } }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  async banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null> {
    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, { transaction });

      if (!user) {
        return null;
      }

      await models.Ban.create(
        {
          userId,
          bannedByUserId: actorUserId,
          reason: input.reason,
          expiresAt: null,
          revokedAt: null
        },
        { transaction }
      );
      await logAdminAction(
        actorUserId,
        {
          action: "user.ban",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { reason: input.reason }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  async revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null> {
    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, { transaction });

      if (!user) {
        return null;
      }

      const [count] = await models.Ban.update(
        { revokedAt: new Date() },
        { where: { userId, ...activeBanWhere }, transaction }
      );

      if (count === 0) {
        return this.reloadUser(user.id, transaction);
      }

      await logAdminAction(
        actorUserId,
        {
          action: "user.ban.revoke",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { revoked: true }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  private async listTagsWithUsage(): Promise<AdminTag[]> {
    const tags = await models.Tag.findAll({ order: [["name", "ASC"]] });
    const usageRows = await models.CharacterTag.findAll({
      attributes: ["tagId", [sequelize.fn("COUNT", sequelize.col("tag_id")), "usageCount"]],
      group: ["tagId"],
      raw: true
    });
    const usageByTag = new Map(
      usageRows.map((row) => [
        row.tagId,
        Number((row as unknown as { usageCount: string | number }).usageCount)
      ])
    );

    return tags.map((tag) => serializeTag(tag, usageByTag.get(tag.id) ?? 0));
  }

  private async countTagUsage(tagId: string, transaction: Transaction) {
    return models.CharacterTag.count({ where: { tagId }, transaction });
  }

  private async reloadUser(userId: string, transaction: Transaction) {
    const user = await models.User.findByPk(userId, {
      include: userInclude,
      transaction
    });

    return user ? serializeUser(user) : null;
  }
}

export const adminRoleNames = roleNames;
export const adminTagTypes = tagTypes;
