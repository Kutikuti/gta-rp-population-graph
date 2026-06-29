import { QueryTypes } from "sequelize";
import type { MigrationParams } from "umzug";

import { authProviders } from "../enums.js";
import type { MigrationContext } from "../migrate.js";

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const enumValuesSql = (values: readonly string[]) =>
  values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes, literal } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    const existingTables = await queryInterface.sequelize.query<{ tableName: string | null }>(
      `SELECT to_regclass('public.user_identities') AS "tableName";`,
      {
        transaction,
        type: QueryTypes.SELECT
      }
    );
    const existingTableName = existingTables[0]?.tableName ?? null;
    const userIdentitiesAlreadyExists = Boolean(existingTableName);

    await queryInterface.changeColumn(
      "users",
      "google_id",
      {
        type: DataTypes.STRING(128),
        allowNull: true,
        unique: true
      },
      { transaction }
    );

    if (!userIdentitiesAlreadyExists) {
      await queryInterface.createTable(
        "user_identities",
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: literal("gen_random_uuid()")
          },
          user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          provider: {
            type: DataTypes.STRING(40),
            allowNull: false
          },
          provider_user_id: {
            type: DataTypes.STRING(191),
            allowNull: false
          },
          provider_email: {
            type: DataTypes.STRING(320),
            allowNull: true
          },
          provider_display_name: {
            type: DataTypes.STRING(160),
            allowNull: true
          },
          provider_avatar_url: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          last_used_at: {
            type: DataTypes.DATE,
            allowNull: true
          },
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
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "user_identities" ADD CONSTRAINT ${quoteIdentifier(
          "user_identities_provider_check"
        )} CHECK ("provider" IN (${enumValuesSql(authProviders)}));`,
        { transaction }
      );

      await queryInterface.addIndex("user_identities", ["provider", "provider_user_id"], {
        name: "user_identities_provider_provider_user_id_uidx",
        unique: true,
        transaction
      });
      await queryInterface.addIndex("user_identities", ["user_id", "provider"], {
        name: "user_identities_user_id_provider_uidx",
        unique: true,
        transaction
      });
      await queryInterface.addIndex("user_identities", ["user_id"], {
        name: "user_identities_user_id_idx",
        transaction
      });
    }

    await queryInterface.sequelize.query(
      `
        INSERT INTO "user_identities" (
          "id",
          "user_id",
          "provider",
          "provider_user_id",
          "provider_email",
          "provider_display_name",
          "provider_avatar_url",
          "last_used_at",
          "created_at",
          "updated_at"
        )
        SELECT
          gen_random_uuid(),
          "id",
          'google',
          "google_id",
          "email",
          "display_name",
          "avatar_url",
          "last_login_at",
          "created_at",
          "updated_at"
        FROM "users"
        WHERE "google_id" IS NOT NULL
        ON CONFLICT DO NOTHING;
      `,
      { transaction }
    );
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("user_identities", { transaction });

    await queryInterface.changeColumn(
      "users",
      "google_id",
      {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true
      },
      { transaction }
    );
  });
};
