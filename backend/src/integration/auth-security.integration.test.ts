import pg from "pg";
import { DataTypes, literal, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import { up } from "../db/migrations/001-initial-schema.js";
import { initModels } from "../db/models/index.js";
import type { SequelizeAdminUserAccessService } from "../services/admin-user-access.js";
import type { ExternalIdentity, SequelizeAuthService } from "../services/auth.js";

const databaseName = `gta_rp_test_auth_${process.pid}_${Date.now()}`;
const maintenanceConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MAINTENANCE_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false
};
let sequelize: Sequelize | undefined;
let models: ReturnType<typeof initModels>;
let service: SequelizeAuthService;
let access: SequelizeAdminUserAccessService;
let databaseCreated = false;

const identity = (
  name: string,
  provider: ExternalIdentity["provider"] = "google"
): ExternalIdentity => ({
  provider,
  providerUserId: name,
  email: `${name}@example.test`,
  displayName: name,
  avatarUrl: null
});
const login = async (name: string) => {
  const result = await service.authenticateIdentity(identity(name));
  if (result.status !== "authenticated") throw new Error("Fixture login failed");
  return result.user;
};

describe("Account security with PostgreSQL", () => {
  beforeAll(async () => {
    expect(env.NODE_ENV).not.toBe("production");
    expect(databaseName).toMatch(/^gta_rp_test_auth_[0-9_]+$/);
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
    await up({
      context: { queryInterface: sequelize.getQueryInterface(), DataTypes, literal },
      name: "001-initial-schema.ts",
      path: "src/db/migrations/001-initial-schema.ts"
    });
    models = initModels(sequelize);
    vi.doMock("../db/index.js", () => ({ models, sequelize }));
    const { SequelizeAuthService } = await import("../services/auth.js");
    const { SequelizeAdminUserAccessService } = await import("../services/admin-user-access.js");
    service = new SequelizeAuthService();
    access = new SequelizeAdminUserAccessService();
  });

  beforeEach(async () => {
    await sequelize?.query("TRUNCATE users CASCADE");
  });

  afterAll(async () => {
    vi.doUnmock("../db/index.js");
    await sequelize?.close();
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

  it("refuses an unlinked identity sharing the administrator email", async () => {
    const owner = await login("owner");
    expect(owner.role.name).toBe("administrator");
    await expect(service.authenticateIdentity(identity("owner", "discord"))).resolves.toEqual({
      status: "email_in_use"
    });
    expect(await models.UserIdentity.count()).toBe(1);
    expect((await login("owner")).id).toBe(owner.id);
  });

  it("grants exactly one administrator during concurrent first logins", async () => {
    const users = await Promise.all([login("first"), login("second"), login("third")]);
    expect(users.filter((user) => user.role.name === "administrator")).toHaveLength(1);
  });

  it("keeps one login method when two providers are unlinked concurrently", async () => {
    const owner = await login("owner");
    expect(await service.linkIdentity(owner.id, identity("owner", "discord"))).toMatchObject({
      status: "linked"
    });
    const outcomes = await Promise.all([
      service.unlinkIdentity(owner.id, "google"),
      service.unlinkIdentity(owner.id, "discord")
    ]);
    expect(outcomes.filter((outcome) => outcome === "last_identity")).toHaveLength(1);
    expect(await models.UserIdentity.count({ where: { userId: owner.id } })).toBe(1);
  });

  it("keeps an administrator during concurrent role removals", async () => {
    const first = await login("first");
    const second = await login("second");
    await access.updateUserRole(first.id, second.id, "administrator");
    const outcomes = await Promise.all([
      access.updateUserRole(first.id, first.id, "user"),
      access.updateUserRole(first.id, second.id, "user")
    ]);
    expect(outcomes.filter((outcome) => outcome === "last_admin")).toHaveLength(1);
  });

  it("does not count a banned administrator as a recovery account", async () => {
    const first = await login("first");
    const second = await login("second");
    await access.updateUserRole(first.id, second.id, "administrator");
    await access.banUser(first.id, second.id, { reason: "Security fixture" });
    await expect(access.updateUserRole(first.id, first.id, "user")).resolves.toBe("last_admin");
    await expect(
      access.banUser(first.id, first.id, { reason: "Security fixture" })
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect((await service.getSessionUser(first.id))?.isBanned).toBe(false);
  });
});
