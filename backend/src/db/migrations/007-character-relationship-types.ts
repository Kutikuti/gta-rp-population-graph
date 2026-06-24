import { QueryTypes, type Transaction } from "sequelize";
import type { MigrationParams } from "umzug";

import { informativeRelationshipTypes, relationshipTypes } from "../enums.js";
import type { MigrationContext } from "../migrate.js";

const relationshipTypeConstraintName = "character_relationships_type_check";
const coreRelationshipTypes = ["parent", "child", "sibling", "couple"] as const;

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const enumValuesSql = (values: readonly string[]) =>
  values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");

const rebuildRelationshipTypeCheck = async (
  queryInterface: MigrationContext["queryInterface"],
  values: readonly string[],
  transaction: Transaction
) => {
  await queryInterface.sequelize.query(
    `ALTER TABLE ${quoteIdentifier("character_relationships")} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(
      relationshipTypeConstraintName
    )};`,
    { transaction }
  );

  await queryInterface.sequelize.query(
    `ALTER TABLE ${quoteIdentifier("character_relationships")} ADD CONSTRAINT ${quoteIdentifier(
      relationshipTypeConstraintName
    )} CHECK (${quoteIdentifier("type")} IN (${enumValuesSql(values)}));`,
    { transaction }
  );
};

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await rebuildRelationshipTypeCheck(queryInterface, relationshipTypes, transaction);
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    const [row] = (await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count
       FROM ${quoteIdentifier("character_relationships")}
       WHERE ${quoteIdentifier("type")} IN (${enumValuesSql(informativeRelationshipTypes)});`,
      { transaction, type: QueryTypes.SELECT }
    )) as Array<{ count: number }>;

    if ((row?.count ?? 0) > 0) {
      throw new Error(
        "Impossible de revenir en arriere: des relations informatives existent deja dans character_relationships."
      );
    }

    await rebuildRelationshipTypeCheck(queryInterface, coreRelationshipTypes, transaction);
  });
};
