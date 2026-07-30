import { Op } from "sequelize";

import { models, sequelize } from "../db/index.js";
import type { JsonObject } from "../db/models/index.js";
import { conflictError, notFoundError } from "../middleware/api-error.js";
import { type AdminService, SequelizeAdminService } from "./admin.js";
import { SequelizeNotionImportService } from "./notion-import.js";
import { scrapePublicNotionPage } from "./notion-scraper.js";

const deferredApplyErrorCode = "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS";
const skippablePhotoErrorCodes = new Set([
  "NOTION_IMPORT_ENTRY_NO_PHOTO",
  "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY"
]);

export type NotionImportAutomationSummary = {
  batchId: string;
  actorUserId: string;
  sourceUrl: string;
  scrapedPages: number;
  apply: {
    passes: number;
    attempted: number;
    applied: number;
    created: number;
    deferred: number;
    invalid: number;
    notFound: number;
    deferredEntries: Array<{
      pageId: string;
      code: string;
      message: string;
    }>;
    invalidEntries: Array<{
      pageId: string;
      code: string;
      message: string;
      details?: JsonObject;
    }>;
  };
  photos: {
    attempted: number;
    imported: number;
    skipped: number;
    invalid: number;
    notFound: number;
    invalidEntries: Array<{
      pageId: string;
      code: string;
      message: string;
      details?: JsonObject;
    }>;
  };
};

type AutomationDeps = {
  adminService: Pick<
    AdminService,
    "applyNotionImportEntry" | "getNotionImportDetail" | "importNotionImportEntryPhoto"
  >;
};

const canAttemptApply = (status: string) => status !== "failed" && status !== "missing";

export const applyNotionImportBatchEntries = async (
  deps: AutomationDeps,
  input: {
    actorUserId: string;
    batchId: string;
  }
) => {
  const detail = await deps.adminService.getNotionImportDetail(input.batchId);

  if (!detail) {
    throw notFoundError("NOTION_IMPORT_BATCH_NOT_FOUND", "Lot d'import Notion introuvable.", {
      batchId: input.batchId
    });
  }

  const remainingPageIds = new Set(
    detail.entries.filter((entry) => canAttemptApply(entry.status)).map((entry) => entry.pageId)
  );
  const deferredEntries = new Map<
    string,
    {
      pageId: string;
      code: string;
      message: string;
    }
  >();
  const invalidEntries: Array<{
    pageId: string;
    code: string;
    message: string;
    details?: JsonObject;
  }> = [];
  let attempted = 0;
  let applied = 0;
  let created = 0;
  let notFound = 0;
  let passes = 0;

  while (remainingPageIds.size > 0) {
    passes += 1;
    let progressed = false;
    const pendingPageIds = [...remainingPageIds];

    for (const pageId of pendingPageIds) {
      attempted += 1;
      const result = await deps.adminService.applyNotionImportEntry({
        actorUserId: input.actorUserId,
        batchId: input.batchId,
        pageId
      });

      if (result.status === "applied") {
        remainingPageIds.delete(pageId);
        deferredEntries.delete(pageId);
        applied += 1;
        if (result.created) {
          created += 1;
        }
        progressed = true;
        continue;
      }

      if (result.status === "not_found") {
        remainingPageIds.delete(pageId);
        notFound += 1;
        continue;
      }

      if (result.code === deferredApplyErrorCode) {
        deferredEntries.set(pageId, {
          pageId,
          code: result.code,
          message: result.message
        });
        continue;
      }

      remainingPageIds.delete(pageId);
      deferredEntries.delete(pageId);
      invalidEntries.push({
        pageId,
        code: result.code,
        message: result.message,
        ...(result.details === undefined ? {} : { details: result.details })
      });
    }

    if (!progressed) {
      break;
    }
  }

  return {
    passes,
    attempted,
    applied,
    created,
    deferred: deferredEntries.size,
    invalid: invalidEntries.length,
    notFound,
    deferredEntries: [...deferredEntries.values()],
    invalidEntries
  };
};

export const importNotionImportBatchPhotos = async (
  deps: AutomationDeps,
  input: {
    actorUserId: string;
    batchId: string;
  }
) => {
  const detail = await deps.adminService.getNotionImportDetail(input.batchId);

  if (!detail) {
    throw notFoundError("NOTION_IMPORT_BATCH_NOT_FOUND", "Lot d'import Notion introuvable.", {
      batchId: input.batchId
    });
  }

  const appliedEntries = detail.entries.filter((entry) => Boolean(entry.appliedCharacterId));
  const invalidEntries: Array<{
    pageId: string;
    code: string;
    message: string;
    details?: JsonObject;
  }> = [];
  let imported = 0;
  let skipped = 0;
  let invalid = 0;
  let notFound = 0;

  for (const entry of appliedEntries) {
    const result = await deps.adminService.importNotionImportEntryPhoto({
      actorUserId: input.actorUserId,
      batchId: input.batchId,
      pageId: entry.pageId
    });

    if (result.status === "imported") {
      imported += 1;
      continue;
    }

    if (result.status === "not_found") {
      notFound += 1;
      continue;
    }

    if (skippablePhotoErrorCodes.has(result.code)) {
      skipped += 1;
      continue;
    }

    invalid += 1;
    invalidEntries.push({
      pageId: entry.pageId,
      code: result.code,
      message: result.message,
      ...(result.details === undefined ? {} : { details: result.details })
    });
  }

  return {
    attempted: appliedEntries.length,
    imported,
    skipped,
    invalid,
    notFound,
    invalidEntries
  };
};

export const resolveNotionImportAutomationActorUserId = async () => {
  const user = await models.User.findOne({
    include: [
      {
        model: models.Role,
        as: "role",
        where: {
          name: {
            [Op.in]: ["administrator", "moderator"]
          }
        }
      }
    ],
    order: [
      [sequelize.literal(`CASE WHEN "role"."name" = 'administrator' THEN 0 ELSE 1 END`), "ASC"],
      ["createdAt", "ASC"]
    ]
  });

  if (!user) {
    throw conflictError(
      "NOTION_IMPORT_AUTOMATION_ACTOR_MISSING",
      "Aucun utilisateur administrateur ou moderateur n'est disponible pour signer l'import automatique."
    );
  }

  return user.id;
};

export class SequelizeNotionImportAutomationService {
  readonly #notionImportService = new SequelizeNotionImportService();
  readonly #adminService = new SequelizeAdminService();

  async run(input: {
    sourceUrl: string;
    actorUserId?: string;
  }): Promise<NotionImportAutomationSummary> {
    const scrapedInput = await scrapePublicNotionPage(input.sourceUrl);
    const imported = await this.#notionImportService.importFromInput(scrapedInput);
    const actorUserId = input.actorUserId ?? (await resolveNotionImportAutomationActorUserId());
    const apply = await applyNotionImportBatchEntries(
      { adminService: this.#adminService },
      {
        actorUserId,
        batchId: imported.batch.id
      }
    );
    const photos = await importNotionImportBatchPhotos(
      { adminService: this.#adminService },
      {
        actorUserId,
        batchId: imported.batch.id
      }
    );

    return {
      batchId: imported.batch.id,
      actorUserId,
      sourceUrl: input.sourceUrl,
      scrapedPages: scrapedInput.pages.length,
      apply,
      photos
    };
  }
}

export const formatNotionImportAutomationSummary = (summary: NotionImportAutomationSummary) => {
  const lines = [
    `Import automatique Notion`,
    `Batch: ${summary.batchId}`,
    `Source: ${summary.sourceUrl}`,
    `Acteur: ${summary.actorUserId}`,
    `Pages scrapées: ${summary.scrapedPages}`,
    `Application: passes=${summary.apply.passes}, tentatives=${summary.apply.attempted}, appliquees=${summary.apply.applied}, creees=${summary.apply.created}, differees=${summary.apply.deferred}, invalides=${summary.apply.invalid}, introuvables=${summary.apply.notFound}`,
    `Photos: tentatives=${summary.photos.attempted}, importees=${summary.photos.imported}, ignorees=${summary.photos.skipped}, invalides=${summary.photos.invalid}, introuvables=${summary.photos.notFound}`
  ];

  if (summary.apply.deferredEntries.length > 0) {
    lines.push("Entrées différées :");
    for (const entry of summary.apply.deferredEntries) {
      lines.push(`- ${entry.pageId}: ${entry.code} - ${entry.message}`);
    }
  }

  if (summary.apply.invalidEntries.length > 0) {
    lines.push("Entrées invalides :");
    for (const entry of summary.apply.invalidEntries) {
      lines.push(`- ${entry.pageId}: ${entry.code} - ${entry.message}`);
    }
  }

  if (summary.photos.invalidEntries.length > 0) {
    lines.push("Photos invalides :");
    for (const entry of summary.photos.invalidEntries) {
      lines.push(`- ${entry.pageId}: ${entry.code} - ${entry.message}`);
    }
  }

  return lines.join("\n");
};
