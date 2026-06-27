import session from "express-session";

import { createSequelizeSessionStore } from "../services/session-store.js";
import { env } from "./env.js";

const persistentStore =
  env.NODE_ENV === "test"
    ? undefined
    : createSequelizeSessionStore({
        ttlHours: env.SESSION_TTL_HOURS,
        cleanupIntervalMinutes: env.SESSION_CLEANUP_INTERVAL_MINUTES
      });

export const sessionMiddleware = session({
  secret: env.SESSION_SECRET,
  name: env.SESSION_COOKIE_NAME,
  resave: false,
  saveUninitialized: false,
  store: persistentStore,
  cookie: {
    httpOnly: true,
    sameSite: env.SESSION_COOKIE_SAME_SITE,
    secure: env.NODE_ENV === "production" && env.SESSION_COOKIE_SECURE
  }
});
