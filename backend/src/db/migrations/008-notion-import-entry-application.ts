import type { MigrationParams } from "umzug";

import type { MigrationContext } from "../migrate.js";

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      "notion_import_entries",
      "applied_character_id",
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "characters", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      { transaction }
    );

    await queryInterface.addColumn(
      "notion_import_entries",
      "applied_by_user_id",
      {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      { transaction }
    );

    await queryInterface.addColumn(
      "notion_import_entries",
      "applied_at",
      {
        type: DataTypes.DATE,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.addIndex("notion_import_entries", ["applied_character_id"], {
      transaction
    });
    await queryInterface.addIndex("notion_import_entries", ["applied_by_user_id"], {
      transaction
    });
    await queryInterface.addIndex("notion_import_entries", ["applied_at"], { transaction });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeIndex("notion_import_entries", ["applied_at"], { transaction });
    await queryInterface.removeIndex("notion_import_entries", ["applied_by_user_id"], {
      transaction
    });
    await queryInterface.removeIndex("notion_import_entries", ["applied_character_id"], {
      transaction
    });
    await queryInterface.removeColumn("notion_import_entries", "applied_at", { transaction });
    await queryInterface.removeColumn("notion_import_entries", "applied_by_user_id", {
      transaction
    });
    await queryInterface.removeColumn("notion_import_entries", "applied_character_id", {
      transaction
    });
  });
};
