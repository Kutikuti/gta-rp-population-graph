import pg from "pg";

import { env } from "../config/env.js";

const assertSafeIdentifier = (value: string, name: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`${name} must contain only letters, numbers and underscores.`);
  }
};

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

assertSafeIdentifier(env.DB_NAME, "DB_NAME");
assertSafeIdentifier(env.DB_MAINTENANCE_NAME, "DB_MAINTENANCE_NAME");

const client = new pg.Client({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MAINTENANCE_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false
});

try {
  await client.connect();

  const existingDatabase = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    env.DB_NAME
  ]);

  if (existingDatabase.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(env.DB_NAME)}`);
    console.log(`Database created: ${env.DB_NAME}`);
  } else {
    console.log(`Database already exists: ${env.DB_NAME}`);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(`Unable to ensure database "${env.DB_NAME}": ${error.message}`);
  }

  process.exitCode = 1;
} finally {
  await client.end();
}
