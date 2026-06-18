import { DataTypes, literal, type Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

import { createSequelize } from "./sequelize.js";

export type MigrationContext = {
  queryInterface: ReturnType<Sequelize["getQueryInterface"]>;
  DataTypes: typeof DataTypes;
  literal: typeof literal;
};

const sequelize = createSequelize();

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
  if (command === "up") {
    await migrator.up();
  } else if (command === "down") {
    await migrator.down(all ? { to: 0 } : undefined);
  } else if (command === "pending") {
    const pending = await migrator.pending();
    console.log(pending.map((migration) => migration.name));
  } else if (command === "executed") {
    const executed = await migrator.executed();
    console.log(executed.map((migration) => migration.name));
  } else {
    throw new Error(`Unknown migration command: ${command}`);
  }
} finally {
  await sequelize.close();
}
