import { Sequelize } from "sequelize";

export type DatabaseConfig = {
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_SSL: boolean;
};

export const createSequelizeConnection = (databaseConfig: DatabaseConfig) =>
  new Sequelize(databaseConfig.DB_NAME, databaseConfig.DB_USER, databaseConfig.DB_PASSWORD, {
    dialect: "postgres",
    host: databaseConfig.DB_HOST,
    port: databaseConfig.DB_PORT,
    logging: false,
    define: {
      underscored: true,
      timestamps: true
    },
    ...(databaseConfig.DB_SSL
      ? {
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        }
      : {})
  });
