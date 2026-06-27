import type { MigrationParams } from "umzug";

import type { MigrationContext } from "../migrate.js";

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" VARCHAR(255) PRIMARY KEY,
        "data" JSONB NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      `,
      { transaction }
    );

    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS "user_sessions_expires_at" ON "user_sessions" ("expires_at");',
      { transaction }
    );
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("user_sessions", { transaction });
  });
};
