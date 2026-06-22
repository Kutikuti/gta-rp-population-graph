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

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes, literal } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      "admin_actions",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        actor_user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        target_user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        action: {
          type: DataTypes.STRING(80),
          allowNull: false
        },
        target_type: {
          type: DataTypes.STRING(80),
          allowNull: false
        },
        target_id: {
          type: DataTypes.UUID,
          allowNull: true
        },
        changes: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.addIndex("admin_actions", ["actor_user_id"], { transaction });
    await queryInterface.addIndex("admin_actions", ["target_user_id"], { transaction });
    await queryInterface.addIndex("admin_actions", ["target_type"], { transaction });
    await queryInterface.addIndex("admin_actions", ["action"], { transaction });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  await context.queryInterface.dropTable("admin_actions");
};
