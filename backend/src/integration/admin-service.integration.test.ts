import pg from "pg";
import { DataTypes, literal, QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import type { MigrationContext } from "../db/migrate.js";
import { down, up } from "../db/migrations/001-initial-schema.js";
import { initModels } from "../db/models/index.js";
import type { AdminService } from "../services/admin.js";

const databaseName = `gta_rp_test_admin_${String(process.pid)}_${String(Date.now())}`;
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
let service: AdminService;

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

const createUser = async (input: {
  email: string;
  displayName: string;
  role: "user" | "moderator" | "administrator";
}) => {
  const [user] = await sequelize.query<{ id: string }>(
    `INSERT INTO users (email, display_name, role_id)
     SELECT $1, $2, id FROM roles WHERE name = $3
     RETURNING id`,
    {
      bind: [input.email, input.displayName, input.role],
      type: QueryTypes.SELECT
    }
  );

  if (!user) {
    throw new Error(`Le role ${input.role} est absent de la base de test.`);
  }

  return user.id;
};

const createIdentity = async (userId: string, provider: "google" | "discord" | "twitch") => {
  await sequelize.query(
    `INSERT INTO user_identities (user_id, provider, provider_user_id)
     VALUES ($1, $2, $3)`,
    { bind: [userId, provider, `${provider}-${userId}`] }
  );
};

const createSession = async (sid: string, userId: string) => {
  await sequelize.query(
    `INSERT INTO user_sessions (sid, data, expires_at)
     VALUES ($1, $2::jsonb, NOW() + INTERVAL '1 day')`,
    { bind: [sid, JSON.stringify({ userId })] }
  );
};

const actionNames = async () => {
  const actions = await sequelize.query<{ action: string }>(
    "SELECT action FROM admin_actions ORDER BY created_at, action",
    { type: QueryTypes.SELECT }
  );
  return actions.map((action) => action.action);
};

describe("SequelizeAdminService with PostgreSQL", () => {
  beforeAll(async () => {
    expect(env.NODE_ENV).not.toBe("production");
    expect(databaseName).toMatch(/^gta_rp_test_admin_[a-zA-Z0-9_]+$/);

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
      define: { underscored: true, timestamps: true },
      dialectOptions: env.DB_SSL ? { ssl: { rejectUnauthorized: false } } : undefined
    });
    await up(migrationParams());

    const models = initModels(sequelize);
    vi.doMock("../db/index.js", () => ({ models, sequelize }));
    const { SequelizeAdminService } = await import("../services/admin.js");
    service = new SequelizeAdminService();
  });

  beforeEach(async () => {
    await sequelize.query(
      "TRUNCATE TABLE admin_actions, users, tags, characters, user_sessions RESTART IDENTITY CASCADE"
    );
  });

  afterAll(async () => {
    vi.doUnmock("../db/index.js");
    if (sequelize) {
      await down(migrationParams()).catch(() => undefined);
      await sequelize.close();
    }
    await dropTestDatabase();
  });

  it("protects the last administrator and audits an allowed role change", async () => {
    const actorId = await createUser({
      email: "admin-one@example.test",
      displayName: "Admin One",
      role: "administrator"
    });

    await expect(service.updateUserRole(actorId, actorId, "user")).resolves.toBe("last_admin");
    expect(await actionNames()).toEqual([]);

    const secondAdminId = await createUser({
      email: "admin-two@example.test",
      displayName: "Admin Two",
      role: "administrator"
    });
    const updatedUser = await service.updateUserRole(actorId, secondAdminId, "moderator");

    expect(updatedUser).toMatchObject({
      id: secondAdminId,
      role: { name: "moderator" }
    });
    expect(await actionNames()).toEqual(["user.role.update"]);
  });

  it("refuses to delete an in-use tag and audits deletion of an unused tag", async () => {
    const actorId = await createUser({
      email: "tag-admin@example.test",
      displayName: "Tag Admin",
      role: "administrator"
    });
    const [character] = await sequelize.query<{ id: string }>(
      `INSERT INTO characters (public_slug, first_name, last_name)
       VALUES ('test-character', 'Test', 'Character') RETURNING id`,
      { type: QueryTypes.SELECT }
    );
    const tags = await sequelize.query<{ id: string; name: string }>(
      `INSERT INTO tags (name, type)
       VALUES ('Utilise', 'other'), ('Libre', 'other') RETURNING id, name`,
      { type: QueryTypes.SELECT }
    );
    const usedTag = tags.find((tag) => tag.name === "Utilise");
    const unusedTag = tags.find((tag) => tag.name === "Libre");
    expect(character && usedTag && unusedTag).toBeTruthy();

    await sequelize.query("INSERT INTO character_tags (character_id, tag_id) VALUES ($1, $2)", {
      bind: [character?.id, usedTag?.id]
    });

    await expect(service.deleteTag(actorId, usedTag?.id ?? "")).resolves.toBe("in_use");
    await expect(service.deleteTag(actorId, unusedTag?.id ?? "")).resolves.toBe("deleted");

    const remainingTags = await sequelize.query<{ name: string }>(
      "SELECT name FROM tags ORDER BY name",
      { type: QueryTypes.SELECT }
    );
    expect(remainingTags.map((tag) => tag.name)).toEqual(["Utilise"]);
    expect(await actionNames()).toEqual(["tag.delete"]);
  });

  it("revokes only the target sessions and preserves the last linked identity", async () => {
    const actorId = await createUser({
      email: "security-admin@example.test",
      displayName: "Security Admin",
      role: "administrator"
    });
    const targetId = await createUser({
      email: "target@example.test",
      displayName: "Target User",
      role: "user"
    });
    await createIdentity(targetId, "google");
    await createIdentity(targetId, "twitch");
    await createSession("target-one", targetId);
    await createSession("target-two", targetId);
    await createSession("actor-session", actorId);

    await expect(service.revokeUserSessions(actorId, targetId)).resolves.toEqual({
      status: "revoked",
      revokedCount: 2
    });
    await expect(service.unlinkUserIdentity(actorId, targetId, "google")).resolves.toEqual({
      status: "unlinked",
      provider: "google"
    });
    await expect(service.unlinkUserIdentity(actorId, targetId, "twitch")).resolves.toEqual({
      status: "last_identity"
    });

    const sessions = await sequelize.query<{ sid: string }>("SELECT sid FROM user_sessions", {
      type: QueryTypes.SELECT
    });
    const identities = await sequelize.query<{ provider: string }>(
      "SELECT provider FROM user_identities WHERE user_id = $1",
      { bind: [targetId], type: QueryTypes.SELECT }
    );
    expect(sessions.map((session) => session.sid)).toEqual(["actor-session"]);
    expect(identities.map((identity) => identity.provider)).toEqual(["twitch"]);
    expect(await actionNames()).toEqual(["user.sessions.revoke", "user.identity.unlink"]);
  });

  it("anonymizes account data, identities and sessions in one audited transaction", async () => {
    const actorId = await createUser({
      email: "privacy-admin@example.test",
      displayName: "Privacy Admin",
      role: "administrator"
    });
    const targetId = await createUser({
      email: "personal@example.test",
      displayName: "Personal Name",
      role: "moderator"
    });
    await sequelize.query(
      "UPDATE users SET avatar_url = 'https://example.test/avatar.png', last_login_at = NOW() WHERE id = $1",
      { bind: [targetId] }
    );
    await createIdentity(targetId, "google");
    await createIdentity(targetId, "discord");
    await createSession("personal-one", targetId);
    await createSession("personal-two", targetId);

    const result = await service.anonymizeUserAccount(actorId, targetId);

    expect(result).toMatchObject({
      status: "anonymized",
      revokedSessions: 2,
      unlinkedIdentities: 2,
      user: {
        id: targetId,
        displayName: "Utilisateur supprimé",
        role: { name: "user" },
        lastLoginAt: null
      }
    });
    if (result.status === "anonymized") {
      expect(result.user.email).toMatch(/^deleted-[0-9a-f-]+@deleted\.local$/);
    }

    const privateRows = await sequelize.query<{ identities: string; sessions: string }>(
      `SELECT
         (SELECT COUNT(*) FROM user_identities WHERE user_id = $1) AS identities,
         (SELECT COUNT(*) FROM user_sessions WHERE data->>'userId' = $2) AS sessions`,
      { bind: [targetId, targetId], type: QueryTypes.SELECT }
    );
    expect(privateRows[0]).toEqual({ identities: "0", sessions: "0" });

    const storedUsers = await sequelize.query<{
      avatarUrl: string | null;
      email: string;
      role: string;
    }>(
      `SELECT u.avatar_url AS "avatarUrl", u.email, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      { bind: [targetId], type: QueryTypes.SELECT }
    );
    expect(storedUsers[0]).toMatchObject({ avatarUrl: null, role: "user" });
    expect(storedUsers[0]?.email).toMatch(/^deleted-[0-9a-f-]+@deleted\.local$/);
    expect(await actionNames()).toEqual(["user.account.anonymize"]);
  });
});
