import { DataTypes, type Sequelize } from "sequelize";

import { authProviders, roleNames } from "../enums.js";
import { AdminAction, Ban, Role, User, UserIdentity, UserSession } from "./identity.js";

const uuidPrimaryKey = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true
};

export const initIdentityModels = (sequelize: Sequelize) => {
  Role.init(
    {
      id: uuidPrimaryKey,
      name: {
        type: DataTypes.ENUM(...roleNames),
        allowNull: false,
        unique: true
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "roles" }
  );

  User.init(
    {
      id: uuidPrimaryKey,
      email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      displayName: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      displayNameChosenAt: DataTypes.DATE,
      avatarUrl: DataTypes.TEXT,
      roleId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      lastLoginAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "users" }
  );

  UserIdentity.init(
    {
      id: uuidPrimaryKey,
      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      provider: {
        type: DataTypes.ENUM(...authProviders),
        allowNull: false
      },
      providerUserId: {
        type: DataTypes.STRING(191),
        allowNull: false
      },
      providerEmail: DataTypes.STRING(320),
      providerDisplayName: DataTypes.STRING(160),
      providerAvatarUrl: DataTypes.TEXT,
      lastUsedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "user_identities",
      indexes: [
        { unique: true, fields: ["provider", "provider_user_id"] },
        { unique: true, fields: ["user_id", "provider"] },
        { fields: ["user_id"] }
      ]
    }
  );

  Ban.init(
    {
      id: uuidPrimaryKey,
      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      bannedByUserId: DataTypes.UUID,
      reason: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      expiresAt: DataTypes.DATE,
      revokedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "bans" }
  );

  AdminAction.init(
    {
      id: uuidPrimaryKey,
      actorUserId: DataTypes.UUID,
      targetUserId: DataTypes.UUID,
      action: {
        type: DataTypes.STRING(80),
        allowNull: false
      },
      targetType: {
        type: DataTypes.STRING(80),
        allowNull: false
      },
      targetId: DataTypes.UUID,
      changes: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "admin_actions",
      indexes: [
        { fields: ["actor_user_id"] },
        { fields: ["target_user_id"] },
        { fields: ["target_type"] },
        { fields: ["action"] }
      ]
    }
  );

  UserSession.init(
    {
      sid: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "user_sessions",
      indexes: [{ fields: ["expires_at"] }]
    }
  );
};
