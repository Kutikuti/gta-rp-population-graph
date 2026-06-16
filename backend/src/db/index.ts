import { createSequelize } from "./sequelize.js";
import { initModels } from "./models/index.js";

export const sequelize = createSequelize();
export const models = initModels(sequelize);
