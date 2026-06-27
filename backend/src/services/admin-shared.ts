import { Op, type Transaction } from "sequelize";

import type { RoleName, TagType } from "../db/enums.js";
import { models } from "../db/index.js";
import type { AdminAction, JsonObject, Tag, User } from "../db/models/index.js";

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

export type TagInput = {
  name: string;
  type: TagType | null;
  colorHex: string;
  description: string | null;
};

export type BanInput = {
  reason: string;
};

export const activeBanWhere = {
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
};

export const userInclude = [
  { model: models.Role, as: "role" },
  { model: models.Ban, as: "bans", required: false, where: activeBanWhere }
];

export const adminActionInclude = [
  { model: models.User, as: "actor", attributes: ["id", "displayName"] },
  { model: models.User, as: "targetUser", attributes: ["id", "displayName"] }
];

export const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

export const serializeUser = (user: User): AdminUser => {
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

export const serializeTag = (tag: Tag, usageCount = 0): AdminTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description,
  usageCount
});

export const serializeAdminAction = (action: AdminAction): AdminActionEntry => ({
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
});

export const logAdminAction = async (
  actorUserId: string,
  input: {
    action: string;
    targetType: string;
    targetId: string | null;
    targetUserId?: string | null;
    changes: JsonObject;
  },
  transaction: Transaction
) => {
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
};
