import { afterEach, describe, expect, it, vi } from "vitest";

import { models } from "../db/index.js";
import { SequelizeDataCompletenessService } from "../services/data-completeness.js";

describe("SequelizeDataCompletenessService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes empty values and flags unknown life status and organization inconsistencies", async () => {
    vi.spyOn(models.Character, "findAll").mockResolvedValue([
      {
        id: "char-1",
        publicSlug: "ines-morel",
        firstName: "Ines",
        lastName: "Morel",
        nickname: "   ",
        birthDate: null,
        photoUrl: "   ",
        phoneNumbers: ["   "],
        streamerId: null,
        socialLinks: { twitch: "   " },
        companyName: "   ",
        companyRank: "Lieutenante",
        companyBadgeNumber: "BP-17",
        lifeStatus: "unknown",
        verificationStatus: "to_check",
        dataSource: "notion",
        sourceNote: "   ",
        updatedAt: new Date("2026-07-05T09:30:00.000Z")
      }
    ] as never);

    const service = new SequelizeDataCompletenessService();
    const report = await service.getReport();

    expect(report.summary).toEqual({
      total: 1,
      withMissingFields: 1,
      importedOrCommunity: 1,
      needsReview: 1
    });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]?.missingFields).toEqual([
      { key: "birthDate", label: "Date de naissance" },
      { key: "lifeStatus", label: "Statut vital" },
      { key: "photoUrl", label: "Photo" },
      { key: "phoneNumbers", label: "Téléphone" },
      { key: "companyName", label: "Entreprise" }
    ]);
    expect(report.items[0]?.attentionFlags).toEqual(["À vérifier", "Importée"]);
  });

  it("does not consider missing media as an incomplete record on its own", async () => {
    vi.spyOn(models.Character, "findAll").mockResolvedValue([
      {
        id: "char-4",
        publicSlug: "malik-serrano",
        firstName: "Malik",
        lastName: "Serrano",
        nickname: "Malik",
        birthDate: "1998-02-03",
        photoUrl: "/uploads/characters/malik.webp",
        phoneNumbers: ["555-0104"],
        streamerId: null,
        socialLinks: null,
        companyName: null,
        companyRank: null,
        companyBadgeNumber: null,
        lifeStatus: "alive",
        verificationStatus: "verified",
        dataSource: "manual",
        sourceNote: "Source validée.",
        updatedAt: new Date("2026-07-05T09:29:00.000Z")
      }
    ] as never);

    const service = new SequelizeDataCompletenessService();
    const report = await service.getReport();

    expect(report.summary).toEqual({
      total: 1,
      withMissingFields: 0,
      importedOrCommunity: 0,
      needsReview: 0
    });
    expect(report.items).toEqual([]);
  });

  it("keeps backend priority order before frontend local sorting", async () => {
    vi.spyOn(models.Character, "findAll").mockResolvedValue([
      {
        id: "char-1",
        publicSlug: "alix-mizuno",
        firstName: "Alix",
        lastName: "Mizuno",
        nickname: "Alix",
        birthDate: "2000-01-01",
        photoUrl: "/uploads/characters/alix.webp",
        phoneNumbers: ["555-0101"],
        streamerId: null,
        socialLinks: { twitch: "https://twitch.tv/alix" },
        companyName: null,
        companyRank: null,
        companyBadgeNumber: null,
        lifeStatus: "alive",
        verificationStatus: "community",
        dataSource: "seed",
        sourceNote: "Source ok.",
        updatedAt: new Date("2026-07-05T09:30:00.000Z")
      },
      {
        id: "char-2",
        publicSlug: "camille-morel",
        firstName: "Camille",
        lastName: "Morel",
        nickname: "Cami",
        birthDate: null,
        photoUrl: null,
        phoneNumbers: [],
        streamerId: null,
        socialLinks: null,
        companyName: "Blue Line",
        companyRank: null,
        companyBadgeNumber: null,
        lifeStatus: "unknown",
        verificationStatus: "to_check",
        dataSource: "notion",
        sourceNote: null,
        updatedAt: new Date("2026-07-05T09:31:00.000Z")
      },
      {
        id: "char-3",
        publicSlug: "ines-morel",
        firstName: "Ines",
        lastName: "Morel",
        nickname: "Ines",
        birthDate: null,
        photoUrl: null,
        phoneNumbers: [],
        streamerId: null,
        socialLinks: null,
        companyName: null,
        companyRank: null,
        companyBadgeNumber: null,
        lifeStatus: "alive",
        verificationStatus: "community",
        dataSource: "seed",
        sourceNote: null,
        updatedAt: new Date("2026-07-05T09:32:00.000Z")
      }
    ] as never);

    const service = new SequelizeDataCompletenessService();
    const report = await service.getReport();

    expect(report.items.map((item) => item.publicSlug)).toEqual([
      "camille-morel",
      "ines-morel",
      "alix-mizuno"
    ]);
  });
});
