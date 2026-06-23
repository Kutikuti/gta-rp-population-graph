import {
  type CreationOptional,
  DataTypes,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute,
  type Sequelize
} from "sequelize";

import {
  type ChangeRequestStatus,
  type ChangeRequestType,
  changeRequestStatuses,
  changeRequestTypes,
  type DataSource,
  dataSources,
  type LifeStatus,
  lifeStatuses,
  type NotionImportBatchStatus,
  type NotionImportEntryStatus,
  notionImportBatchStatuses,
  notionImportEntryStatuses,
  type RelationshipDirection,
  type RelationshipType,
  type RoleName,
  relationshipDirections,
  relationshipTypes,
  roleNames,
  type TagType,
  tagTypes,
  type VerificationStatus,
  verificationStatuses
} from "../enums.js";

export type JsonObject = Record<string, unknown>;
export type SocialLinks = Partial<
  Record<"twitch" | "kick" | "youtube" | "instagram" | "tiktok", string>
>;

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<string>;
  declare name: RoleName;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare googleId: string;
  declare email: string;
  declare displayName: string;
  declare displayNameChosenAt: Date | null;
  declare avatarUrl: string | null;
  declare roleId: ForeignKey<Role["id"]>;
  declare lastLoginAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare role?: NonAttribute<Role>;
  declare bans?: NonAttribute<Ban[]>;
}

export class Ban extends Model<InferAttributes<Ban>, InferCreationAttributes<Ban>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare bannedByUserId: ForeignKey<User["id"]> | null;
  declare reason: string;
  declare expiresAt: Date | null;
  declare revokedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare bannedBy?: NonAttribute<User>;
}

export class AdminAction extends Model<
  InferAttributes<AdminAction>,
  InferCreationAttributes<AdminAction>
> {
  declare id: CreationOptional<string>;
  declare actorUserId: ForeignKey<User["id"]> | null;
  declare targetUserId: ForeignKey<User["id"]> | null;
  declare action: string;
  declare targetType: string;
  declare targetId: string | null;
  declare changes: JsonObject;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare actor?: NonAttribute<User | null>;
  declare targetUser?: NonAttribute<User | null>;
}

export class NotionImportBatch extends Model<
  InferAttributes<NotionImportBatch>,
  InferCreationAttributes<NotionImportBatch>
> {
  declare id: CreationOptional<string>;
  declare sourceName: string;
  declare sourceSnapshot: JsonObject;
  declare status: NotionImportBatchStatus;
  declare report: JsonObject;
  declare validatedByUserId: ForeignKey<User["id"]> | null;
  declare validatedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare entries?: NonAttribute<NotionImportEntry[]>;
  declare validatedBy?: NonAttribute<User | null>;
}

export class NotionImportEntry extends Model<
  InferAttributes<NotionImportEntry>,
  InferCreationAttributes<NotionImportEntry>
> {
  declare id: CreationOptional<string>;
  declare batchId: ForeignKey<NotionImportBatch["id"]>;
  declare sourcePageId: string;
  declare sourceUrl: string | null;
  declare rawContent: JsonObject;
  declare contentHash: string;
  declare previousContentHash: string | null;
  declare status: NotionImportEntryStatus;
  declare mappedSnapshot: JsonObject;
  declare mappingReport: JsonObject;
  declare lastSeenAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare batch?: NonAttribute<NotionImportBatch>;
}

export class Streamer extends Model<InferAttributes<Streamer>, InferCreationAttributes<Streamer>> {
  declare id: CreationOptional<string>;
  declare publicName: string;
  declare primaryPlatform: string | null;
  declare socialLinks: SocialLinks | null;
  declare verificationStatus: VerificationStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Character extends Model<
  InferAttributes<Character>,
  InferCreationAttributes<Character>
> {
  declare id: CreationOptional<string>;
  declare publicSlug: string;
  declare firstName: string;
  declare lastName: string;
  declare nickname: string | null;
  declare birthDate: string | null;
  declare lifeStatus: LifeStatus;
  declare deathOrDepartureDate: string | null;
  declare photoUrl: string | null;
  declare businessName: string | null;
  declare businessRank: string | null;
  declare businessBadgeNumber: string | null;
  declare phoneNumber: string | null;
  declare streamerId: ForeignKey<Streamer["id"]> | null;
  declare socialLinks: SocialLinks | null;
  declare groupName: string | null;
  declare groupRole: string | null;
  declare district: string | null;
  declare isRpDeath: boolean;
  declare policeRank: string | null;
  declare policeBadgeNumber: string | null;
  declare previousCharacters: JsonObject | null;
  declare verificationStatus: VerificationStatus;
  declare dataSource: DataSource;
  declare sourceNote: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare streamer?: NonAttribute<Streamer | null>;
  declare tags?: NonAttribute<Tag[]>;
  declare outgoingRelationships?: NonAttribute<CharacterRelationship[]>;
  declare incomingRelationships?: NonAttribute<CharacterRelationship[]>;
}

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare type: TagType | null;
  declare colorHex: string;
  declare description: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class CharacterTag extends Model<
  InferAttributes<CharacterTag>,
  InferCreationAttributes<CharacterTag>
> {
  declare characterId: ForeignKey<Character["id"]>;
  declare tagId: ForeignKey<Tag["id"]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class CharacterRelationship extends Model<
  InferAttributes<CharacterRelationship>,
  InferCreationAttributes<CharacterRelationship>
> {
  declare id: CreationOptional<string>;
  declare sourceCharacterId: ForeignKey<Character["id"]>;
  declare targetCharacterId: ForeignKey<Character["id"]>;
  declare type: RelationshipType;
  declare direction: RelationshipDirection;
  declare label: string;
  declare description: string | null;
  declare source: DataSource;
  declare verificationStatus: VerificationStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare sourceCharacter?: NonAttribute<Character>;
  declare targetCharacter?: NonAttribute<Character>;
}

export class ChangeRequest extends Model<
  InferAttributes<ChangeRequest>,
  InferCreationAttributes<ChangeRequest>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare requestType: ChangeRequestType;
  declare characterId: ForeignKey<Character["id"]> | null;
  declare proposedSnapshot: JsonObject;
  declare searchContext: JsonObject | null;
  declare status: ChangeRequestStatus;
  declare reviewerId: ForeignKey<User["id"]> | null;
  declare moderatorComment: string | null;
  declare resolvedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare character?: NonAttribute<Character>;
  declare reviewer?: NonAttribute<User | null>;
}

export class ChangeHistory extends Model<
  InferAttributes<ChangeHistory>,
  InferCreationAttributes<ChangeHistory>
> {
  declare id: CreationOptional<string>;
  declare characterId: ForeignKey<Character["id"]>;
  declare changeRequestId: ForeignKey<ChangeRequest["id"]> | null;
  declare moderatorId: ForeignKey<User["id"]> | null;
  declare changes: JsonObject;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare character?: NonAttribute<Character>;
  declare changeRequest?: NonAttribute<ChangeRequest | null>;
  declare moderator?: NonAttribute<User | null>;
}

const uuidPrimaryKey = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true
};

export const initModels = (sequelize: Sequelize) => {
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
      googleId: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true
      },
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

  NotionImportBatch.init(
    {
      id: uuidPrimaryKey,
      sourceName: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      sourceSnapshot: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM(...notionImportBatchStatuses),
        allowNull: false,
        defaultValue: "draft"
      },
      report: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      validatedByUserId: DataTypes.UUID,
      validatedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "notion_import_batches",
      indexes: [{ fields: ["status"] }]
    }
  );

  NotionImportEntry.init(
    {
      id: uuidPrimaryKey,
      batchId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      sourcePageId: {
        type: DataTypes.STRING(240),
        allowNull: false
      },
      sourceUrl: DataTypes.TEXT,
      rawContent: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      contentHash: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      previousContentHash: DataTypes.STRING(64),
      status: {
        type: DataTypes.ENUM(...notionImportEntryStatuses),
        allowNull: false
      },
      mappedSnapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      mappingReport: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "notion_import_entries",
      indexes: [{ fields: ["batch_id"] }, { fields: ["source_page_id"] }, { fields: ["status"] }]
    }
  );

  Streamer.init(
    {
      id: uuidPrimaryKey,
      publicName: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true
      },
      primaryPlatform: DataTypes.STRING(40),
      socialLinks: DataTypes.JSONB,
      verificationStatus: {
        type: DataTypes.ENUM(...verificationStatuses),
        allowNull: false,
        defaultValue: "to_check"
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "streamers" }
  );

  Character.init(
    {
      id: uuidPrimaryKey,
      publicSlug: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true
      },
      firstName: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      nickname: DataTypes.STRING(160),
      birthDate: DataTypes.DATEONLY,
      lifeStatus: {
        type: DataTypes.ENUM(...lifeStatuses),
        allowNull: false,
        defaultValue: "unknown"
      },
      deathOrDepartureDate: DataTypes.DATEONLY,
      photoUrl: DataTypes.TEXT,
      businessName: DataTypes.STRING(160),
      businessRank: DataTypes.STRING(120),
      businessBadgeNumber: DataTypes.STRING(80),
      phoneNumber: DataTypes.STRING(40),
      streamerId: DataTypes.UUID,
      socialLinks: DataTypes.JSONB,
      groupName: DataTypes.STRING(160),
      groupRole: DataTypes.STRING(120),
      district: DataTypes.STRING(120),
      isRpDeath: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      policeRank: DataTypes.STRING(120),
      policeBadgeNumber: DataTypes.STRING(80),
      previousCharacters: DataTypes.JSONB,
      verificationStatus: {
        type: DataTypes.ENUM(...verificationStatuses),
        allowNull: false,
        defaultValue: "to_check"
      },
      dataSource: {
        type: DataTypes.ENUM(...dataSources),
        allowNull: false,
        defaultValue: "other"
      },
      sourceNote: DataTypes.TEXT,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "characters",
      indexes: [
        { fields: ["public_slug"], unique: true },
        { fields: ["first_name", "last_name"] },
        { fields: ["phone_number"] },
        { fields: ["life_status"] },
        { fields: ["verification_status"] }
      ]
    }
  );

  Tag.init(
    {
      id: uuidPrimaryKey,
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
      },
      type: DataTypes.ENUM(...tagTypes),
      colorHex: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: "#2f9bff",
        validate: { is: /^#[0-9a-f]{6}$/i }
      },
      description: DataTypes.TEXT,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "tags" }
  );

  CharacterTag.init(
    {
      characterId: {
        type: DataTypes.UUID,
        primaryKey: true
      },
      tagId: {
        type: DataTypes.UUID,
        primaryKey: true
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    { sequelize, tableName: "character_tags" }
  );

  CharacterRelationship.init(
    {
      id: uuidPrimaryKey,
      sourceCharacterId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      targetCharacterId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM(...relationshipTypes),
        allowNull: false
      },
      direction: {
        type: DataTypes.ENUM(...relationshipDirections),
        allowNull: false
      },
      label: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      description: DataTypes.TEXT,
      source: {
        type: DataTypes.ENUM(...dataSources),
        allowNull: false,
        defaultValue: "other"
      },
      verificationStatus: {
        type: DataTypes.ENUM(...verificationStatuses),
        allowNull: false,
        defaultValue: "to_check"
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "character_relationships",
      indexes: [
        { fields: ["source_character_id"] },
        { fields: ["target_character_id"] },
        { fields: ["type"] }
      ]
    }
  );

  ChangeRequest.init(
    {
      id: uuidPrimaryKey,
      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      requestType: {
        type: DataTypes.ENUM(...changeRequestTypes),
        allowNull: false,
        defaultValue: "update"
      },
      characterId: {
        type: DataTypes.UUID,
        allowNull: true
      },
      proposedSnapshot: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      searchContext: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM(...changeRequestStatuses),
        allowNull: false,
        defaultValue: "pending"
      },
      reviewerId: DataTypes.UUID,
      moderatorComment: DataTypes.TEXT,
      resolvedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "change_requests",
      indexes: [
        { fields: ["status"] },
        { fields: ["user_id"] },
        { fields: ["character_id"] },
        { fields: ["request_type"] }
      ]
    }
  );

  ChangeHistory.init(
    {
      id: uuidPrimaryKey,
      characterId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      changeRequestId: DataTypes.UUID,
      moderatorId: DataTypes.UUID,
      changes: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "change_histories",
      indexes: [{ fields: ["character_id"] }, { fields: ["moderator_id"] }]
    }
  );

  Role.hasMany(User, { foreignKey: "roleId", as: "users" });
  User.belongsTo(Role, { foreignKey: "roleId", as: "role" });

  User.hasMany(Ban, { foreignKey: "userId", as: "bans" });
  Ban.belongsTo(User, { foreignKey: "userId", as: "user" });
  Ban.belongsTo(User, { foreignKey: "bannedByUserId", as: "bannedBy" });

  User.hasMany(AdminAction, { foreignKey: "actorUserId", as: "adminActions" });
  User.hasMany(AdminAction, { foreignKey: "targetUserId", as: "targetedAdminActions" });
  AdminAction.belongsTo(User, { foreignKey: "actorUserId", as: "actor" });
  AdminAction.belongsTo(User, { foreignKey: "targetUserId", as: "targetUser" });

  User.hasMany(NotionImportBatch, {
    foreignKey: "validatedByUserId",
    as: "validatedNotionImportBatches"
  });
  NotionImportBatch.belongsTo(User, { foreignKey: "validatedByUserId", as: "validatedBy" });
  NotionImportBatch.hasMany(NotionImportEntry, { foreignKey: "batchId", as: "entries" });
  NotionImportEntry.belongsTo(NotionImportBatch, { foreignKey: "batchId", as: "batch" });

  Streamer.hasMany(Character, { foreignKey: "streamerId", as: "characters" });
  Character.belongsTo(Streamer, { foreignKey: "streamerId", as: "streamer" });

  Character.belongsToMany(Tag, {
    through: CharacterTag,
    foreignKey: "characterId",
    otherKey: "tagId",
    as: "tags"
  });
  Tag.belongsToMany(Character, {
    through: CharacterTag,
    foreignKey: "tagId",
    otherKey: "characterId",
    as: "characters"
  });

  Character.hasMany(CharacterRelationship, {
    foreignKey: "sourceCharacterId",
    as: "outgoingRelationships"
  });
  Character.hasMany(CharacterRelationship, {
    foreignKey: "targetCharacterId",
    as: "incomingRelationships"
  });
  CharacterRelationship.belongsTo(Character, {
    foreignKey: "sourceCharacterId",
    as: "sourceCharacter"
  });
  CharacterRelationship.belongsTo(Character, {
    foreignKey: "targetCharacterId",
    as: "targetCharacter"
  });

  User.hasMany(ChangeRequest, { foreignKey: "userId", as: "changeRequests" });
  ChangeRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
  ChangeRequest.belongsTo(User, { foreignKey: "reviewerId", as: "reviewer" });
  Character.hasMany(ChangeRequest, { foreignKey: "characterId", as: "changeRequests" });
  ChangeRequest.belongsTo(Character, { foreignKey: "characterId", as: "character" });

  Character.hasMany(ChangeHistory, { foreignKey: "characterId", as: "changeHistory" });
  ChangeHistory.belongsTo(Character, { foreignKey: "characterId", as: "character" });
  ChangeHistory.belongsTo(ChangeRequest, { foreignKey: "changeRequestId", as: "changeRequest" });
  ChangeHistory.belongsTo(User, { foreignKey: "moderatorId", as: "moderator" });

  return {
    Role,
    User,
    Ban,
    AdminAction,
    NotionImportBatch,
    NotionImportEntry,
    Streamer,
    Character,
    Tag,
    CharacterTag,
    CharacterRelationship,
    ChangeRequest,
    ChangeHistory
  };
};
