import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const booleanFromString = z
  .string()
  .default("false")
  .transform((value) => value === "true");

const migrationEnvSchema = z.object({
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_SSL: booleanFromString
});

export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

export const parseMigrationEnv = (environment: NodeJS.ProcessEnv): MigrationEnv =>
  migrationEnvSchema.parse(environment);

export const loadMigrationEnv = (): MigrationEnv => {
  dotenv.config({ path: resolve(process.cwd(), "migrations.env"), quiet: true });
  return parseMigrationEnv(process.env);
};
