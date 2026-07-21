import pg from "pg";
import { DataTypes, literal, QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import type { MigrationContext } from "../db/migrate.js";
import { down, up } from "../db/migrations/001-initial-schema.js";

const databaseName = `gta_rp_test_${String(process.pid)}_${String(Date.now())}`;
const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const maintenanceConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MAINTENANCE_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false
};

let sequelize: Sequelize;
let migrationWasReverted = false;

const migrationContext = (): MigrationContext => ({
  queryInterface: sequelize.getQueryInterface(),
  DataTypes,
  literal
});

const migrationParams = () => ({
  context: migrationContext(),
  name: "001-initial-schema.ts",
  path: "src/db/migrations/001-initial-schema.ts"
});

const dropTestDatabase = async () => {
  const client = new pg.Client(maintenanceConfig);
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName]
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
  } finally {
    await client.end();
  }
};

describe("initial PostgreSQL schema", () => {
  beforeAll(async () => {
    expect(env.NODE_ENV).not.toBe("production");
    expect(databaseName).toMatch(/^gta_rp_test_[a-zA-Z0-9_]+$/);

    const client = new pg.Client(maintenanceConfig);
    await client.connect();
    try {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    } finally {
      await client.end();
    }

    sequelize = new Sequelize(databaseName, env.DB_USER, env.DB_PASSWORD, {
      dialect: "postgres",
      host: env.DB_HOST,
      port: env.DB_PORT,
      logging: false,
      pool: { max: 1, min: 0, idle: 1_000 },
      ...(env.DB_SSL ? { dialectOptions: { ssl: { rejectUnauthorized: false } } } : {})
    });
    await up(migrationParams());
  });

  afterAll(async () => {
    if (sequelize) {
      if (!migrationWasReverted) {
        await down(migrationParams()).catch(() => undefined);
      }
      await sequelize.close();
    }
    await dropTestDatabase();
  });

  it("creates all expected tables and initial roles", async () => {
    const tables = await sequelize.getQueryInterface().showAllTables();
    expect(tables).toEqual(
      expect.arrayContaining([
        "roles",
        "users",
        "user_sessions",
        "streamers",
        "characters",
        "tags",
        "character_relationships",
        "change_requests",
        "change_histories",
        "notion_import_batches",
        "notion_import_entries"
      ])
    );

    const roles = await sequelize.query<{ name: string }>("SELECT name FROM roles ORDER BY name", {
      type: QueryTypes.SELECT
    });
    expect(roles.map((role) => role.name)).toEqual(["administrator", "moderator", "user"]);
  });

  it("enforces enum checks and relationship integrity", async () => {
    await expect(
      sequelize.query("INSERT INTO roles (name) VALUES ('invalid-role')")
    ).rejects.toThrow();

    const characters = await sequelize.query<{ id: string }>(
      `INSERT INTO characters (public_slug, first_name, last_name)
       VALUES ('camille-morel', 'Camille', 'Morel'), ('ines-morel', 'Inès', 'Morel')
       RETURNING id`,
      { type: QueryTypes.SELECT }
    );
    const firstId = characters[0]?.id;
    const secondId = characters[1]?.id;
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();

    await expect(
      sequelize.query(
        `INSERT INTO character_relationships
          (source_character_id, target_character_id, type, direction, label)
         VALUES ($1, $1, 'sibling', 'symmetric', 'Fratrie')`,
        { bind: [firstId] }
      )
    ).rejects.toThrow();

    await sequelize.query(
      `INSERT INTO character_relationships
        (source_character_id, target_character_id, type, direction, label)
       VALUES ($1, $2, 'sibling', 'symmetric', 'Fratrie')`,
      { bind: [firstId, secondId] }
    );
    await sequelize.query("DELETE FROM characters WHERE id = $1", { bind: [firstId] });
    const relationshipCount = await sequelize.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM character_relationships",
      { type: QueryTypes.SELECT }
    );
    expect(relationshipCount[0]?.count).toBe("0");
  });

  it("rolls back failed application transactions", async () => {
    await expect(
      sequelize.transaction(async (transaction) => {
        await sequelize.query("INSERT INTO tags (name, type) VALUES ('Rollback tag', 'other')", {
          transaction
        });
        throw new Error("force rollback");
      })
    ).rejects.toThrow("force rollback");

    const tags = await sequelize.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tags WHERE name = 'Rollback tag'",
      { type: QueryTypes.SELECT }
    );
    expect(tags[0]?.count).toBe("0");
  });

  it("reverts the initial migration cleanly", async () => {
    await down(migrationParams());
    migrationWasReverted = true;

    const tables = await sequelize.getQueryInterface().showAllTables();
    expect(tables).toEqual([]);
  });
});
