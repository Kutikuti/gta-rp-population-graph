import { DataTypes, type Sequelize } from "sequelize";

import { notionImportBatchStatuses, notionImportEntryStatuses } from "../enums.js";
import { NotionImportBatch, NotionImportEntry } from "./notion.js";

const uuidPrimaryKey = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true
};

export const initNotionImportModels = (sequelize: Sequelize) => {
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
      appliedCharacterId: DataTypes.UUID,
      appliedByUserId: DataTypes.UUID,
      appliedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "notion_import_entries",
      indexes: [
        { fields: ["batch_id"] },
        { fields: ["source_page_id"] },
        { fields: ["status"] },
        { fields: ["applied_character_id"] },
        { fields: ["applied_by_user_id"] },
        { fields: ["applied_at"] }
      ]
    }
  );
};
