import type { Transaction } from "sequelize";

import { models, sequelize } from "../db/index.js";
import { type AdminTag, logAdminAction, serializeTag, type TagInput } from "./admin-shared.js";

export class SequelizeAdminTagService {
  async listTagsWithUsage(): Promise<AdminTag[]> {
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

  private async countTagUsage(tagId: string, transaction: Transaction) {
    return models.CharacterTag.count({ where: { tagId }, transaction });
  }
}
