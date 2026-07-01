import type { MigrationParams } from "umzug";

import type { MigrationContext } from "../migrate.js";

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    const table = await queryInterface.describeTable("characters");

    if (!("phone_number" in table) || "phone_numbers" in table) {
      return;
    }

    await queryInterface.addColumn(
      "characters",
      "phone_numbers",
      {
        type: DataTypes.JSONB,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.sequelize.query(
      `UPDATE "characters"
       SET "phone_numbers" = CASE
         WHEN "phone_number" IS NULL OR BTRIM("phone_number") = '' THEN NULL
         ELSE jsonb_build_array("phone_number")
       END;`,
      { transaction }
    );

    await queryInterface
      .removeIndex("characters", "characters_phone_number_idx", {
        transaction
      })
      .catch(() => undefined);
    await queryInterface.removeColumn("characters", "phone_number", { transaction });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    const table = await queryInterface.describeTable("characters");

    if (!("phone_numbers" in table) || "phone_number" in table) {
      return;
    }

    await queryInterface.addColumn(
      "characters",
      "phone_number",
      {
        type: DataTypes.STRING(40),
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.sequelize.query(
      `UPDATE "characters"
       SET "phone_number" = CASE
         WHEN jsonb_typeof("phone_numbers") = 'array' AND jsonb_array_length("phone_numbers") > 0
           THEN "phone_numbers"->>0
         ELSE NULL
       END;`,
      { transaction }
    );

    await queryInterface.removeColumn("characters", "phone_numbers", { transaction });
    await queryInterface.addIndex("characters", ["phone_number"], {
      name: "characters_phone_number_idx",
      transaction
    });
  });
};
