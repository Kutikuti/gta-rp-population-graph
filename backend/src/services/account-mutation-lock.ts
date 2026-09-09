import type { Transaction } from "sequelize";

import { sequelize } from "../db/index.js";

// Login, identity changes and administration share this transaction lock so
// concurrent requests cannot claim the first admin or remove the last login.
export const lockAccountMutations = async (transaction: Transaction) => {
  await sequelize.query("SELECT pg_advisory_xact_lock(173568, 1)", { transaction });
};
