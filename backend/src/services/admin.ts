import type { Transaction } from "sequelize";

import { type RoleName, roleNames, tagTypes } from "../db/enums.js";
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
export type {
  AdminActionEntry,
  AdminDashboard,
  AdminTag,
  AdminUser,
  BanInput,
  TagInput
} from "./admin-shared.js";

export type AdminService = {
  getDashboard(): Promise<AdminDashboard>;
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
