import pg from "pg";
import { DataTypes, literal, Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import { down, up } from "../db/migrations/001-initial-schema.js";
import { initModels } from "../db/models/index.js";
import type { PublicDataService } from "../services/public-data.js";

const databaseName = `gta_rp_test_search_${process.pid}_${Date.now()}`;
const maintenanceConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MAINTENANCE_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false
};
let sequelize: Sequelize | undefined;
let service: PublicDataService;
let databaseCreated = false;
let characterIds: string[];
const migrationParams = (connection: Sequelize) => ({
  context: { queryInterface: connection.getQueryInterface(), DataTypes, literal },
  name: "001-initial-schema.ts",
  path: "src/db/migrations/001-initial-schema.ts"
});

describe("Public search with PostgreSQL", () => {
  beforeAll(async () => {
    expect(env.NODE_ENV).not.toBe("production");
    expect(databaseName).toMatch(/^gta_rp_test_search_[0-9_]+$/);
    const client = new pg.Client(maintenanceConfig);
    await client.connect();
    try {
      await client.query(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
    } finally {
      await client.end();
    }
    sequelize = new Sequelize(databaseName, env.DB_USER, env.DB_PASSWORD, {
      dialect: "postgres",
      host: env.DB_HOST,
      port: env.DB_PORT,
      logging: false,
      define: { underscored: true, timestamps: true },
      ...(env.DB_SSL ? { dialectOptions: { ssl: { rejectUnauthorized: false } } } : {})
    });
    await up(migrationParams(sequelize));
    const models = initModels(sequelize);
    vi.doMock("../db/index.js", () => ({ models, sequelize }));
    const { SequelizePublicDataService } = await import("../services/public-data.js");
    service = new SequelizePublicDataService();
    const streamer = await models.Streamer.create({
      publicName: "Nova'RP",
      primaryPlatform: "twitch",
      verificationStatus: "community"
    });
    const first = await models.Character.create({
      lifeStatus: "alive",
      isRpDeath: false,
      verificationStatus: "community",
      dataSource: "seed",
      firstName: "Alice",
      lastName: "Test",
      publicSlug: "alice-test",
      streamerId: streamer.id,
      companyName: "Garage"
    });
    const second = await models.Character.create({
      lifeStatus: "alive",
      isRpDeath: false,
      verificationStatus: "community",
      dataSource: "seed",
      firstName: "Bruno",
      lastName: "Test",
      publicSlug: "bruno-test",
      streamerId: streamer.id,
      companyName: "Hopital"
    });
    await models.Character.create({
      lifeStatus: "alive",
      isRpDeath: false,
      verificationStatus: "community",
      dataSource: "seed",
      firstName: "Camille",
      lastName: "Test",
      publicSlug: "camille-test"
    });
    characterIds = [first.id, second.id];
  });

  afterAll(async () => {
    vi.doUnmock("../db/index.js");
    if (sequelize) {
      await down(migrationParams(sequelize)).catch(() => undefined);
      await sequelize.close();
    }
    if (!databaseCreated) return;
    const client = new pg.Client(maintenanceConfig);
    await client.connect();
    try {
      await client.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName]
      );
      await client.query(`DROP DATABASE "${databaseName}"`);
    } finally {
      await client.end();
    }
  });

  it("finds all characters by public streamer name and preserves pagination", async () => {
    expect(await service.listCharacterMatches({ q: "nova'rp" })).toEqual({
      ids: characterIds,
      total: 2
    });
    const page = await service.listCharacters({ q: "NOVA'RP", limit: 1, offset: 1 });
    expect(page.total).toBe(2);
    expect(page.items.map((character) => character.id)).toEqual([characterIds[1]]);
    expect((await service.listCharacterMatches({ q: "Alice" })).ids).toEqual([characterIds[0]]);
  });

  it("combines universal search with company filters and treats SQL-like input as text", async () => {
    expect((await service.listCharacterMatches({ q: "nova", company: "Garage" })).ids).toEqual([
      characterIds[0]
    ]);
    expect(await service.listCharacterMatches({ q: "' OR 1=1 --" })).toEqual({ ids: [], total: 0 });
    expect((await service.listCharacters({ limit: 10, offset: 0 })).total).toBe(3);
  });
});
