import type { Transaction } from "sequelize";

import type { RoleName } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import {
  type AdminUser,
  activeBanWhere,
  type BanInput,
  logAdminAction,
  serializeUser,
  userInclude
} from "./admin-shared.js";

export class SequelizeAdminUserAccessService {
  async updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null> {
    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, {
        include: userInclude(),
        transaction
      });
      const nextRole = await models.Role.findOne({ where: { name: roleName }, transaction });

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
        { where: { userId, ...activeBanWhere() }, transaction }
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

  private async reloadUser(userId: string, transaction: Transaction) {
    const user = await models.User.findByPk(userId, {
      include: userInclude(),
      transaction
    });

    return user ? serializeUser(user) : null;
  }
}
