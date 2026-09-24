import { env } from "../config/env.js";
import { createSequelizeConnection } from "./sequelize-connection.js";

export const createSequelize = () => createSequelizeConnection(env);
