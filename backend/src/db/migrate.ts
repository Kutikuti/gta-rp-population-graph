import { DataTypes, literal, type Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

import { loadMigrationEnv } from "../config/migration-env.js";
import { runMigrationCommand } from "./migration-command.js";
import { createSequelizeConnection } from "./sequelize-connection.js";

export type MigrationContext = {
  queryInterface: ReturnType<Sequelize["getQueryInterface"]>;
  DataTypes: typeof DataTypes;
  literal: typeof literal;
};

const sequelize = createSequelizeConnection(loadMigrationEnv());

const migrator = new Umzug<MigrationContext>({
  migrations: {
    glob: ["src/db/migrations/*.ts", { cwd: process.cwd() }]
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    DataTypes,
    literal
  },
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

const command = process.argv[2] ?? "up";
const all = process.argv.includes("--all");

try {
  const result = await runMigrationCommand(migrator, command, all);
  if (result) console.log(result);
} finally {
  await sequelize.close();
}
