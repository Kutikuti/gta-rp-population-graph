import { sequelize } from "./db/index.js";
import {
  formatNotionImportSummary,
  SequelizeNotionImportService
} from "./services/notion-import.js";
import { scrapePublicNotionPage } from "./services/notion-scraper.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const sourceUrl = args.find((arg) => !arg.startsWith("--"));

try {
  if (!sourceUrl) {
    throw new Error("Usage: npm run notion:scrape-report -- <notion-url>");
  }

  const input = await scrapePublicNotionPage(sourceUrl);
  const service = new SequelizeNotionImportService();
  const result = await service.importFromInput(input);

  const output = {
    scrapedPages: input.pages.length,
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
