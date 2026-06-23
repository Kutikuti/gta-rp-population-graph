import type { Transaction } from "sequelize";
import type { MigrationParams } from "umzug";

import type { MigrationContext } from "../migrate.js";

const timestampColumns = (
  DataTypes: MigrationContext["DataTypes"],
  literal: MigrationContext["literal"]
) => ({
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP")
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP")
  }
});

const uuidPrimaryKey = (
  DataTypes: MigrationContext["DataTypes"],
  literal: MigrationContext["literal"]
) => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: literal("gen_random_uuid()")
});

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const enumValuesSql = (values: readonly string[]) =>
  values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");

const addEnumCheck = async (
  queryInterface: MigrationContext["queryInterface"],
  tableName: string,
  columnName: string,
  values: readonly string[],
  transaction: Transaction
) => {
  const column = quoteIdentifier(columnName);

  await queryInterface.sequelize.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(
      `${tableName}_${columnName}_check`
    )} CHECK (${column} IN (${enumValuesSql(values)}));`,
    { transaction }
  );
};

const batchStatuses = ["draft", "mapped", "reported", "failed"] as const;
const entryStatuses = ["new", "updated", "unchanged", "missing", "failed"] as const;

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes, literal } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      "notion_import_batches",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        source_name: {
          type: DataTypes.STRING(160),
          allowNull: false
        },
        source_snapshot: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        status: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: "draft"
        },
        report: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        validated_by_user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        validated_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "notion_import_entries",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        batch_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "notion_import_batches", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        source_page_id: {
          type: DataTypes.STRING(240),
          allowNull: false
        },
        source_url: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        raw_content: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        content_hash: {
          type: DataTypes.STRING(64),
          allowNull: false
        },
        previous_content_hash: {
          type: DataTypes.STRING(64),
          allowNull: true
        },
        status: {
          type: DataTypes.STRING(40),
          allowNull: false
        },
        mapped_snapshot: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        mapping_report: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        last_seen_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: literal("CURRENT_TIMESTAMP")
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await addEnumCheck(
      queryInterface,
      "notion_import_batches",
      "status",
      batchStatuses,
      transaction
    );
    await addEnumCheck(
      queryInterface,
      "notion_import_entries",
      "status",
      entryStatuses,
      transaction
    );

    await queryInterface.addIndex("notion_import_batches", ["status"], { transaction });
    await queryInterface.addIndex("notion_import_entries", ["batch_id"], { transaction });
    await queryInterface.addIndex("notion_import_entries", ["source_page_id"], { transaction });
    await queryInterface.addIndex("notion_import_entries", ["status"], { transaction });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("notion_import_entries", { transaction });
    await queryInterface.dropTable("notion_import_batches", { transaction });
  });
};
