import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const booleanFromString = z
  .string()
  .default("false")
  .transform((value) => value === "true");

const numberFromString = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: numberFromString(4000),
    WEB_CLIENT_URL: z.url().default("http://localhost:5173"),
    DB_NAME: z.string().min(1).default("gta_rp_population_graph"),
    DB_USER: z.string().min(1).default("postgres"),
    DB_PASSWORD: z.string().min(1).default("postgres"),
    DB_HOST: z.string().min(1).default("localhost"),
    DB_PORT: numberFromString(5432),
    DB_SSL: booleanFromString,
    SESSION_SECRET: z.string().min(32).default("replace-with-a-long-random-secret"),
    SESSION_COOKIE_NAME: z.string().min(1).default("gta_rp_session"),
    SESSION_COOKIE_SECURE: booleanFromString,
    SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.url().optional(),
    RATE_LIMIT_WINDOW_MS: numberFromString(900000),
    RATE_LIMIT_MAX_REQUESTS: numberFromString(100),
    CHANGE_REQUEST_RATE_LIMIT_MAX: numberFromString(10)
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production") {
      if (value.SESSION_SECRET === "replace-with-a-long-random-secret") {
        context.addIssue({
          code: "custom",
          path: ["SESSION_SECRET"],
          message: "SESSION_SECRET must be changed in production."
        });
      }

      if (!value.SESSION_COOKIE_SECURE) {
        context.addIssue({
          code: "custom",
          path: ["SESSION_COOKIE_SECURE"],
          message: "SESSION_COOKIE_SECURE must be true in production."
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", z.treeifyError(parsedEnv.error));
  process.exit(1);
}

export const env = parsedEnv.data;
