import { DataTypes, type Sequelize } from "sequelize";

import {
  dataSources,
  lifeStatuses,
  relationshipDirections,
  relationshipTypes,
  tagTypes,
  verificationStatuses
} from "../enums.js";
import { Character, CharacterRelationship, CharacterTag, Streamer, Tag } from "./character.js";

const uuidPrimaryKey = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true
};

export const initCharacterModels = (sequelize: Sequelize) => {
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
      companyName: DataTypes.STRING(160),
      companyRank: DataTypes.STRING(120),
      companyBadgeNumber: DataTypes.STRING(80),
      phoneNumbers: DataTypes.JSONB,
      streamerId: DataTypes.UUID,
      groupName: DataTypes.STRING(160),
      district: DataTypes.STRING(120),
      isRpDeath: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
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
};
