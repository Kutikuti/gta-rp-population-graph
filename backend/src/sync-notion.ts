import { sequelize } from "./db/index.js";
import { defaultNotionSourceUrl } from "./notion-defaults.js";
import { SequelizeAdminService } from "./services/admin.js";
import {
  formatNotionImportAutomationSummary,
  importNotionImportBatchPhotos,
  resolveNotionImportAutomationActorUserId,
  SequelizeNotionImportAutomationService
} from "./services/notion-import-automation.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const photosOnly = args.includes("--photos-only");
const actorUserIdArg = args.find((arg) => arg.startsWith("--actor-user-id="));
const actorUserId = actorUserIdArg
  ? actorUserIdArg.replace("--actor-user-id=", "").trim() || undefined
  : undefined;
const batchIdArg = args.find((arg) => arg.startsWith("--batch-id="));
const batchId = batchIdArg ? batchIdArg.replace("--batch-id=", "").trim() || undefined : undefined;
const sourceUrl = args.find((arg) => !arg.startsWith("--")) ?? defaultNotionSourceUrl;

try {
  if (photosOnly) {
    if (!batchId) {
      throw new Error("--batch-id est requis avec --photos-only.");
    }

    const resolvedActorUserId = actorUserId ?? (await resolveNotionImportAutomationActorUserId());
    const photos = await importNotionImportBatchPhotos(
      { adminService: new SequelizeAdminService() },
      {
        actorUserId: resolvedActorUserId,
        batchId
      }
    );
    const result = { batchId, actorUserId: resolvedActorUserId, photos };

    console.log(jsonOutput ? JSON.stringify(result, null, 2) : JSON.stringify(result));
    process.exitCode = 0;
  } else {
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
  }
} finally {
  await sequelize.close();
}
