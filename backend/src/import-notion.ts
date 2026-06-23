import { sequelize } from "./db/index.js";
import {
  formatNotionImportSummary,
  loadNotionImportInputFile,
  SequelizeNotionImportService
} from "./services/notion-import.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const inputPath = args.find((arg) => !arg.startsWith("--"));

try {
  if (!inputPath) {
    throw new Error("Usage: npm run notion:import-report -- <input.json>");
  }

  const input = await loadNotionImportInputFile(inputPath);
  const service = new SequelizeNotionImportService();
  const result = await service.importFromInput(input);

  const output = {
    batchId: result.batch.id,
    report: result.report
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatNotionImportSummary(output));
  }
} finally {
  await sequelize.close();
}
