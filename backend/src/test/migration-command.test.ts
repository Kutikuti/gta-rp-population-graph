import { describe, expect, it, vi } from "vitest";

import { parseMigrationEnv } from "../config/migration-env.js";
import { runMigrationCommand } from "../db/migration-command.js";

const sqlOnlyEnvironment = {
  DB_NAME: "gta_test",
  DB_USER: "migration_user",
  DB_PASSWORD: "database-password",
  DB_HOST: "127.0.0.1"
};

describe("migration configuration and read-only commands", () => {
  it("accepts only SQL connection settings without session secrets", () => {
    expect(parseMigrationEnv(sqlOnlyEnvironment)).toEqual({
      ...sqlOnlyEnvironment,
      DB_PORT: 5432,
      DB_SSL: false
    });
  });

  it("rejects migration configuration without required database credentials", () => {
    expect(() =>
      parseMigrationEnv({
        DB_NAME: "gta_test",
        DB_USER: "migration_user",
        DB_HOST: "127.0.0.1"
      })
    ).toThrow();
  });

  it.each(["pending", "executed"] as const)(
    "runs %s without applying migrations",
    async (command) => {
      const runner = {
        up: vi.fn(),
        down: vi.fn(),
        pending: vi.fn().mockResolvedValue([{ name: "001-initial.ts" }]),
        executed: vi.fn().mockResolvedValue([{ name: "000-bootstrap.ts" }])
      };

      const result = await runMigrationCommand(runner, command);

      expect(result).toEqual(command === "pending" ? ["001-initial.ts"] : ["000-bootstrap.ts"]);
      expect(runner.up).not.toHaveBeenCalled();
      expect(runner.down).not.toHaveBeenCalled();
    }
  );
});
