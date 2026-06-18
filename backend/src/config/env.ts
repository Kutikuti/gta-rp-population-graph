import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "backend/.env"),
  resolve(currentDir, "../../.env")
];
const envPath = envPaths.find((candidate) => existsSync(candidate));

dotenv.config({ path: envPath, quiet: true });

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
    DB_MAINTENANCE_NAME: z.string().min(1).default("postgres"),
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
    const googleValues = [
      value.GOOGLE_CLIENT_ID,
      value.GOOGLE_CLIENT_SECRET,
      value.GOOGLE_CALLBACK_URL
    ];
    const hasAnyGoogleOauthConfig = googleValues.some(Boolean);
    const hasAllGoogleOauthConfig = googleValues.every(Boolean);

    if (hasAnyGoogleOauthConfig && !hasAllGoogleOauthConfig) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL must all be set together."
      });
    }

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
