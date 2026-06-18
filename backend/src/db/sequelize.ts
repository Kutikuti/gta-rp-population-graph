import { Sequelize } from "sequelize";

import { env } from "../config/env.js";

export const createSequelize = () =>
  new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    dialect: "postgres",
    host: env.DB_HOST,
    port: env.DB_PORT,
    logging: false,
    dialectOptions: env.DB_SSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : undefined,
    define: {
      underscored: true,
      timestamps: true
    }
  });
