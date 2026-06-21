import type { MigrationParams } from "umzug";

import type { MigrationContext } from "../migrate.js";

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      "users",
      "display_name_chosen_at",
      {
        type: DataTypes.DATE,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.sequelize.query(
      `UPDATE "users"
       SET "display_name" = CONCAT('Utilisateur ', SUBSTRING("id"::text, 1, 8))
       WHERE "display_name_chosen_at" IS NULL;`,
      { transaction }
    );
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn("users", "display_name_chosen_at", { transaction });
  });
};
