import { describe, expect, it } from "vitest";

import type { AdminService } from "../services/admin.js";
import {
  applyNotionImportBatchEntries,
  importNotionImportBatchPhotos
} from "../services/notion-import-automation.js";

const detail = {
  batch: {
    id: "batch-1",
    sourceName: "Flashback Whitelist V6",
    status: "reported",
    sourceSnapshot: {},
    totals: {},
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  },
  entries: [
    {
      status: "new",
      pageId: "page-a",
      fullName: "Ada Lovelace",
      lifeStatus: "alive",
      streamer: null,
      socialLinks: null,
      company: null,
      group: null,
      tags: "",
      photoReferences: [],
      sourceUrl: null,
      rawContent: {},
      mappedSnapshot: {},
      mappingReport: {},
      appliedCharacterId: null,
      appliedAt: null,
      createdAt: "2026-07-05T00:00:00.000Z"
    },
    {
      status: "updated",
      pageId: "page-b",
      fullName: "Grace Hopper",
      lifeStatus: "alive",
      streamer: null,
      socialLinks: null,
      company: null,
      group: null,
      tags: "",
      photoReferences: [],
      sourceUrl: null,
      rawContent: {},
      mappedSnapshot: {},
      mappingReport: {},
      appliedCharacterId: null,
      appliedAt: null,
      createdAt: "2026-07-05T00:00:00.000Z"
    }
  ]
} satisfies Awaited<ReturnType<AdminService["getNotionImportDetail"]>> extends infer T
  ? NonNullable<T>
  : never;

describe("notion import automation", () => {
  it("retries deferred relationship applications across several passes", async () => {
    let firstAttempt = true;
    const adminService = {
      async getNotionImportDetail() {
        return detail;
      },
      async applyNotionImportEntry(input: { pageId: string }) {
        if (input.pageId === "page-a") {
          return {
            status: "applied" as const,
            entry: detail.entries[0],
            characterId: "char-a",
            created: true
          };
        }

        if (firstAttempt) {
          firstAttempt = false;
          return {
            status: "invalid" as const,
            code: "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS",
            message: "Attente relation liée."
          };
        }

        return {
          status: "applied" as const,
          entry: detail.entries[1],
          characterId: "char-b",
          created: false
        };
      },
      async importNotionImportEntryPhoto() {
        return { status: "not_found" as const };
      }
    };

    const result = await applyNotionImportBatchEntries(
      {
        adminService: adminService as Pick<
          AdminService,
          "applyNotionImportEntry" | "getNotionImportDetail" | "importNotionImportEntryPhoto"
        >
      },
      {
        actorUserId: "admin-1",
        batchId: "batch-1"
      }
    );

    expect(result).toMatchObject({
      passes: 2,
      attempted: 3,
      applied: 2,
      created: 1,
      deferred: 0,
      invalid: 0,
      notFound: 0
    });
  });

  it("skips missing photos without treating them as invalid", async () => {
    const adminService = {
      async getNotionImportDetail() {
        return {
          ...detail,
          entries: [
            { ...detail.entries[0], appliedCharacterId: "char-a" },
            { ...detail.entries[1], appliedCharacterId: "char-b" }
          ]
        };
      },
      async applyNotionImportEntry() {
        return { status: "not_found" as const };
      },
      async importNotionImportEntryPhoto(input: { pageId: string }) {
        if (input.pageId === "page-a") {
          return {
            status: "imported" as const,
            entry: detail.entries[0],
            characterId: "char-a",
            photoUrl: "/uploads/characters/ada.webp"
          };
        }

        return {
          status: "invalid" as const,
          code: "NOTION_IMPORT_ENTRY_NO_PHOTO",
          message: "Pas de photo."
        };
      }
    };

    const result = await importNotionImportBatchPhotos(
      {
        adminService: adminService as Pick<
          AdminService,
          "applyNotionImportEntry" | "getNotionImportDetail" | "importNotionImportEntryPhoto"
        >
      },
      {
        actorUserId: "admin-1",
        batchId: "batch-1"
      }
    );

    expect(result).toMatchObject({
      attempted: 2,
      imported: 1,
      skipped: 1,
      invalid: 0,
      notFound: 0
    });
  });
});
