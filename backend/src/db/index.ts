import { initModels } from "./models/index.js";
import { createSequelize } from "./sequelize.js";

export const sequelize = createSequelize();
export const models = initModels(sequelize);
