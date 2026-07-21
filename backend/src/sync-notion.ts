import { sequelize } from "./db/index.js";
import { defaultNotionSourceUrl } from "./notion-defaults.js";
import {
  formatNotionImportAutomationSummary,
  SequelizeNotionImportAutomationService
} from "./services/notion-import-automation.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const actorUserIdArg = args.find((arg) => arg.startsWith("--actor-user-id="));
const actorUserId = actorUserIdArg
  ? actorUserIdArg.replace("--actor-user-id=", "").trim() || undefined
  : undefined;
const sourceUrl = args.find((arg) => !arg.startsWith("--")) ?? defaultNotionSourceUrl;

try {
  const service = new SequelizeNotionImportAutomationService();
  const result = await service.run({
    sourceUrl,
    ...(actorUserId ? { actorUserId } : {})
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatNotionImportAutomationSummary(result));
  }
} finally {
  await sequelize.close();
}
