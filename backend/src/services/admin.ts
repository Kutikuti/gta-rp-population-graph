import { Op, type Transaction } from "sequelize";

import { type RoleName, roleNames, type TagType, tagTypes } from "../db/enums.js";
import {
  initModels,
  type JsonObject,
  type NotionImportBatch,
  type NotionImportEntry,
  Role,
  type Tag,
  type User
} from "../db/models/index.js";
import { createSequelize } from "../db/sequelize.js";
import { type NotionImportPreviewItem, previewNotionImportEntry } from "./notion-import.js";

const sequelize = createSequelize();
const models = initModels(sequelize);

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminTag = {
  id: string;
  name: string;
  type: TagType | null;
  colorHex: string;
  description: string | null;
  usageCount: number;
};

export type AdminActionEntry = {
  id: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  targetUser: {
    id: string;
    displayName: string;
  } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: JsonObject;
  createdAt: string;
};

export type AdminDashboard = {
  users: AdminUser[];
  tags: AdminTag[];
  actions: AdminActionEntry[];
};

export type AdminNotionImportBatch = {
  id: string;
  sourceName: string;
  status: string;
  sourceSnapshot: JsonObject;
  totals: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotionImportEntry = NotionImportPreviewItem & {
  rawContent: JsonObject;
  mappedSnapshot: JsonObject;
  mappingReport: JsonObject;
  createdAt: string;
};

export type AdminNotionImportDetail = {
  batch: AdminNotionImportBatch;
  entries: AdminNotionImportEntry[];
};

export type TagInput = {
  name: string;
  type: TagType | null;
  colorHex: string;
  description: string | null;
};

export type BanInput = {
  reason: string;
};

export type AdminService = {
  getDashboard(): Promise<AdminDashboard>;
  listNotionImports(): Promise<AdminNotionImportBatch[]>;
  getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null>;
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

const activeBanWhere = {
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
};

const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

const serializeUser = (user: User): AdminUser => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: {
      id: user.role.id,
      name: user.role.name
    },
    isBanned: Boolean(user.bans?.length),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: isoDate(user.lastLoginAt)
  };
};

const serializeTag = (tag: Tag, usageCount = 0): AdminTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description,
  usageCount
});

const serializeImportBatch = (batch: NotionImportBatch): AdminNotionImportBatch => ({
  id: batch.id,
  sourceName: batch.sourceName,
  status: batch.status,
  sourceSnapshot: batch.sourceSnapshot,
  totals:
    batch.report && typeof batch.report === "object" && "totals" in batch.report
      ? ((batch.report as { totals?: Record<string, number> }).totals ?? {})
      : {},
  createdAt: batch.createdAt.toISOString(),
  updatedAt: batch.updatedAt.toISOString()
});

const serializeImportEntry = (entry: NotionImportEntry): AdminNotionImportEntry => ({
  ...previewNotionImportEntry(entry),
  rawContent: entry.rawContent,
  mappedSnapshot: entry.mappedSnapshot,
  mappingReport: entry.mappingReport,
  createdAt: entry.createdAt.toISOString()
});

const userInclude = [
  { model: Role, as: "role" },
  { model: models.Ban, as: "bans", required: false, where: activeBanWhere }
];

export class SequelizeAdminService implements AdminService {
  async getDashboard(): Promise<AdminDashboard> {
    const [users, tags, actions] = await Promise.all([
      models.User.findAll({
        include: userInclude,
        order: [["createdAt", "DESC"]]
      }),
      this.listTagsWithUsage(),
      models.AdminAction.findAll({
        include: [
          { model: models.User, as: "actor", attributes: ["id", "displayName"] },
          { model: models.User, as: "targetUser", attributes: ["id", "displayName"] }
        ],
        order: [["createdAt", "DESC"]],
        limit: 50
      })
    ]);

    return {
      users: users.map(serializeUser),
      tags,
      actions: actions.map((action) => ({
        id: action.id,
        actor: action.actor ? { id: action.actor.id, displayName: action.actor.displayName } : null,
        targetUser: action.targetUser
          ? { id: action.targetUser.id, displayName: action.targetUser.displayName }
          : null,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        changes: action.changes,
        createdAt: action.createdAt.toISOString()
      }))
    };
  }

  async listNotionImports(): Promise<AdminNotionImportBatch[]> {
    const batches = await models.NotionImportBatch.findAll({
      order: [["createdAt", "DESC"]],
      limit: 20
    });

    return batches.map(serializeImportBatch);
  }

  async getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null> {
    const batch = await models.NotionImportBatch.findByPk(batchId);

    if (!batch) {
      return null;
    }

    const entries = await models.NotionImportEntry.findAll({
      where: { batchId },
      order: [
        ["status", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    return {
      batch: serializeImportBatch(batch),
      entries: entries.map(serializeImportEntry)
    };
  }

  async createTag(actorUserId: string, input: TagInput): Promise<AdminTag> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.create(input, { transaction });
      await this.logAction(
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
      await this.logAction(
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
      await this.logAction(
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
      await this.logAction(
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
      await this.logAction(
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

      await this.logAction(
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

  private async logAction(
    actorUserId: string,
    input: {
      action: string;
      targetType: string;
      targetId: string | null;
      targetUserId?: string | null;
      changes: JsonObject;
    },
    transaction: Transaction
  ) {
    await models.AdminAction.create(
      {
        actorUserId,
        targetUserId: input.targetUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        changes: input.changes
      },
      { transaction }
    );
  }
}

export const adminRoleNames = roleNames;
export const adminTagTypes = tagTypes;
