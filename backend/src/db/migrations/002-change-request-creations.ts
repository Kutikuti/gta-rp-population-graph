import type { Transaction } from "sequelize";
import type { MigrationParams } from "umzug";

import { changeRequestTypes } from "../enums.js";
import type { MigrationContext } from "../migrate.js";

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

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      "change_requests",
      "request_type",
      {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "update"
      },
      { transaction }
    );
    await addEnumCheck(
      queryInterface,
      "change_requests",
      "request_type",
      changeRequestTypes,
      transaction
    );
    await queryInterface.addColumn(
      "change_requests",
      "search_context",
      {
        type: DataTypes.JSONB,
        allowNull: true
      },
      { transaction }
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "change_requests" ALTER COLUMN "character_id" DROP NOT NULL;',
      { transaction }
    );
    await queryInterface.addIndex("change_requests", ["request_type"], {
      name: "change_requests_request_type_idx",
      transaction
    });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.bulkDelete("change_requests", { request_type: "create" }, { transaction });
    await queryInterface.sequelize.query(
      'ALTER TABLE "change_requests" ALTER COLUMN "character_id" SET NOT NULL;',
      { transaction }
    );
    await queryInterface.removeIndex("change_requests", "change_requests_request_type_idx", {
      transaction
    });
    await queryInterface.removeConstraint("change_requests", "change_requests_request_type_check", {
      transaction
    });
    await queryInterface.removeColumn("change_requests", "search_context", { transaction });
    await queryInterface.removeColumn("change_requests", "request_type", { transaction });
  });
};
