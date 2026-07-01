import { models, sequelize } from "./db/index.js";
import { previewNotionImportEntry } from "./services/notion-import.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.replace("--limit=", ""), 10) : 30;
const batchId = args.find((arg) => !arg.startsWith("--"));

try {
  const batch = batchId
    ? await models.NotionImportBatch.findByPk(batchId)
    : await models.NotionImportBatch.findOne({ order: [["createdAt", "DESC"]] });

  if (!batch) {
    throw new Error(batchId ? `Batch Notion introuvable: ${batchId}` : "Aucun batch Notion.");
  }

  const entries = await models.NotionImportEntry.findAll({
    where: { batchId: batch.id },
    order: [
      ["status", "ASC"],
      ["createdAt", "ASC"]
    ]
  });
  const preview = entries
    .filter((entry) => entry.status !== "missing")
    .map((entry) => previewNotionImportEntry(entry));
  const totals = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.status] = (accumulator[entry.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const output = {
    batchId: batch.id,
    sourceName: batch.sourceName,
    status: batch.status,
    totals,
    totalCandidates: preview.length,
    candidates: preview.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 30)
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Batch: ${output.batchId}`);
    console.log(`Source: ${output.sourceName}`);
    console.log(`Statut batch: ${output.status}`);
    console.log(
      `Entrees: new=${totals.new ?? 0}, updated=${totals.updated ?? 0}, unchanged=${
        totals.unchanged ?? 0
      }, missing=${totals.missing ?? 0}, failed=${totals.failed ?? 0}`
    );
    console.log(`Candidats affiches: ${output.candidates.length}/${output.totalCandidates}`);
    console.table(
      output.candidates.map((candidate) => ({
        status: candidate.status,
        nom: candidate.fullName,
        vie: candidate.lifeStatus,
        twitch: candidate.twitch ?? candidate.streamer,
        metier: candidate.company,
        groupe: candidate.group,
        tags: candidate.tags,
        pageId: candidate.pageId
      }))
    );
  }
} finally {
  await sequelize.close();
}
