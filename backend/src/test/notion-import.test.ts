import { describe, expect, it } from "vitest";

import {
  buildNotionImportPlan,
  formatNotionImportSummary,
  hashNotionRawContent,
  mapNotionPage,
  type NotionImportInput,
  type PreviousNotionImportEntry,
  previewNotionImportEntry
} from "../services/notion-import.js";

const baseInput = {
  sourceName: "Notion Flashback test",
  sourceUrl: "https://example.com/notion-source",
  fullSource: true,
  pages: [
    {
      pageId: "page-ada",
      url: "https://example.com/page-ada",
      properties: {
        Prenom: "Ada",
        Nom: "Lovelace",
        Surnom: "Countess",
        Telephone: "555-0101",
        Streamer: "AdaLive",
        Tags: ["Famille", "Tech"],
        Twitch: "https://twitch.example/adalive",
        Relations: [
          { type: "couple", target: "Grace Hopper" },
          { type: "collegue", target: "Charles Babbage" }
        ],
        Photo: "https://example.com/ada.webp",
        "Titre Notion": "Ada Lovelace",
        "Champ inconnu": "a verifier"
      }
    },
    {
      pageId: "page-grace",
      properties: {
        Prenom: "Grace",
        Nom: "Hopper"
      }
    }
  ]
} satisfies NotionImportInput;

describe("notion import mapping", () => {
  it("maps recognized fields and reports unknown or ambiguous data without fetching photos", () => {
    const page = baseInput.pages.at(0);

    if (!page) {
      throw new Error("Fixture Notion invalide.");
    }

    const result = mapNotionPage(page);

    expect(result.mapped).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      streamerPublicName: "AdaLive",
      dataSource: "notion",
      verificationStatus: "imported"
    });
    expect(result.report.recognizedFields).toEqual(
      expect.arrayContaining(["Prenom", "Nom", "Streamer", "Photo"])
    );
    expect(result.report.unknownFields).toEqual(["Champ inconnu"]);
    expect(result.report.ambiguousRelations).toEqual([
      { type: "collegue", target: "Charles Babbage" }
    ]);
    expect(result.report.photoReferences).toEqual(["https://example.com/ada.webp"]);
  });

  it("maps Flashback status, police fields and group tags from Notion properties", () => {
    const aliveResult = mapNotionPage({
      pageId: "page-heitor",
      properties: {
        Prenom: "Heitor Leite",
        Nom: "JR",
        "Statut vital": "En vie",
        "Métier/entreprise": "SASP",
        Poste: "Rookie",
        Matricule: "99",
        Famille: "Leite JR",
        Groupes: "Aucun groupe"
      }
    });
    const deceasedResult = mapNotionPage({
      pageId: "page-lune",
      properties: {
        Prenom: "Lune",
        Nom: "Suarez",
        "Statut vital": "Mort/Morte",
        "Métier/entreprise": "SASD",
        Poste: "Député 2",
        Matricule: "110",
        Famille: "Suarez",
        Groupes: "Aucun groupe"
      }
    });
    const groupResult = mapNotionPage({
      pageId: "page-paolo",
      properties: {
        Prenom: "Paolo Benavides de",
        Nom: "Alva",
        "Statut vital": "En vie",
        "Métier/entreprise": "Université,SAMD",
        Poste: "Etudiant,Brancardier",
        Famille: "Benavides de Alva",
        Groupes: "Richman Lane,6block",
        Quartier: "6block"
      }
    });

    expect(aliveResult.mapped).toMatchObject({
      lifeStatus: "alive",
      policeRank: "Rookie",
      policeBadgeNumber: "99",
      tags: []
    });
    expect(deceasedResult.mapped).toMatchObject({
      lifeStatus: "deceased",
      policeRank: "Député 2",
      policeBadgeNumber: "110",
      tags: []
    });
    expect(groupResult.mapped.tags).toEqual(["Richman Lane", "6block"]);
    expect(groupResult.mapped.policeRank).toBeNull();
    expect(groupResult.mapped.policeBadgeNumber).toBeNull();
    expect(groupResult.report.recognizedFields).toEqual(
      expect.arrayContaining(["Famille", "Groupes", "Statut vital"])
    );
  });

  it("marks incomplete pages as failed candidates instead of silently publishing them", () => {
    const plan = buildNotionImportPlan(
      {
        ...baseInput,
        pages: [
          {
            pageId: "page-missing-name",
            properties: {
              Prenom: "SansNom"
            }
          }
        ]
      },
      []
    );

    expect(plan.report.publishesPublicData).toBe(false);
    expect(plan.entries[0]?.status).toBe("failed");
    expect(plan.entries[0]?.mappingReport.errors).toEqual(["Champ obligatoire absent: lastName"]);
  });

  it("detects new, updated, unchanged and missing pages when the import is replayed", () => {
    const unchangedRaw = {
      pageId: "page-grace",
      url: null,
      properties: {
        Prenom: "Grace",
        Nom: "Hopper"
      }
    };
    const updatedPreviousRaw = {
      pageId: "page-ada",
      url: "https://example.com/page-ada",
      properties: {
        Prenom: "Ada",
        Nom: "Old"
      }
    };
    const previousEntries: PreviousNotionImportEntry[] = [
      {
        sourcePageId: "page-ada",
        contentHash: hashNotionRawContent(updatedPreviousRaw),
        rawContent: updatedPreviousRaw
      },
      {
        sourcePageId: "page-grace",
        contentHash: hashNotionRawContent(unchangedRaw),
        rawContent: unchangedRaw
      },
      {
        sourcePageId: "page-removed",
        contentHash: hashNotionRawContent({
          pageId: "page-removed",
          url: null,
          properties: { Prenom: "Gone", Nom: "Away" }
        }),
        rawContent: {
          pageId: "page-removed",
          url: null,
          properties: { Prenom: "Gone", Nom: "Away" }
        }
      }
    ];

    const plan = buildNotionImportPlan(
      {
        ...baseInput,
        pages: [
          ...baseInput.pages,
          {
            pageId: "page-new",
            properties: {
              Prenom: "New",
              Nom: "Person"
            }
          }
        ]
      },
      previousEntries
    );

    const statuses = Object.fromEntries(
      plan.entries.map((entry) => [entry.sourcePageId, entry.status] as const)
    );

    expect(statuses).toMatchObject({
      "page-ada": "updated",
      "page-grace": "unchanged",
      "page-new": "new",
      "page-removed": "missing"
    });
    expect(plan.report.totals).toMatchObject({
      new: 1,
      updated: 1,
      unchanged: 1,
      missing: 1,
      failed: 0
    });
  });

  it("formats a compact terminal summary instead of dumping every page", () => {
    const plan = buildNotionImportPlan(
      {
        ...baseInput,
        pages: [
          ...baseInput.pages,
          {
            pageId: "page-missing-last-name",
            properties: {
              Prenom: "Only"
            }
          }
        ]
      },
      []
    );
    const summary = formatNotionImportSummary({
      batchId: "batch-test",
      scrapedPages: 3,
      report: plan.report
    });

    expect(summary).toContain("Batch: batch-test");
    expect(summary).toContain("Pages scrapees: 3");
    expect(summary).toContain("failed=1");
    expect(summary).toContain("Erreurs (1)");
    expect(summary).toContain("Champs inconnus (1) : Champ inconnu");
    expect(summary).not.toContain("Titre Notion");
  });

  it("builds preview rows for candidate visualization", () => {
    const item = previewNotionImportEntry({
      status: "new",
      sourcePageId: "page-ada",
      sourceUrl: "https://example.com/page-ada",
      mappedSnapshot: {
        firstName: "Ada",
        lastName: "Lovelace",
        lifeStatus: "alive",
        streamerPublicName: "AdaLive",
        socialLinks: { twitch: "https://twitch.example/adalive" },
        businessName: "Laboratoire",
        groupName: "Analystes",
        tags: ["Famille", "Tech"]
      }
    });

    expect(item).toEqual({
      status: "new",
      pageId: "page-ada",
      fullName: "Ada Lovelace",
      lifeStatus: "alive",
      streamer: "AdaLive",
      twitch: "https://twitch.example/adalive",
      business: "Laboratoire",
      group: "Analystes",
      tags: "Famille, Tech",
      sourceUrl: "https://example.com/page-ada"
    });
  });
});
