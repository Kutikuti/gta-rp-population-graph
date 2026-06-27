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
        V6: ["Analia Cruz", "Milo Vega"],
        "Père relation": "Victor Lovelace",
        "Frères/Soeurs relation": "Byron Lovelace",
        "Couple relation": "Grace Hopper",
        "Est oncle/tante": "Noah Example",
        "Ex/Exs relation": "Charles Babbage",
        "Oncle relation": "Henri Example",
        "Tante relation": "Julia Example",
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
    expect(result.mapped.relationships).toEqual(
      expect.arrayContaining([
        { type: "couple", target: "Grace Hopper" },
        { type: "collegue", target: "Charles Babbage" },
        { type: "previous_character", target: "Analia Cruz" },
        { type: "previous_character", target: "Milo Vega" },
        { type: "parent", target: "Victor Lovelace" },
        { type: "sibling", target: "Byron Lovelace" },
        { type: "couple_reference", target: "Grace Hopper" },
        { type: "aunt_or_uncle_reference", target: "Noah Example" },
        { type: "ex_partner_reference", target: "Charles Babbage" },
        { type: "uncle_reference", target: "Henri Example" },
        { type: "aunt_reference", target: "Julia Example" }
      ])
    );
    expect(result.mapped.previousCharacters).toEqual({
      raw: null,
      v6: ["Analia Cruz", "Milo Vega"]
    });
    expect(result.report.recognizedFields).toEqual(
      expect.arrayContaining([
        "Prenom",
        "Nom",
        "Streamer",
        "Photo",
        "V6",
        "Père relation",
        "Frères/Soeurs relation",
        "Couple relation",
        "Est oncle/tante",
        "Ex/Exs relation",
        "Oncle relation",
        "Tante relation"
      ])
    );
    expect(result.report.unknownFields).toEqual(["Champ inconnu"]);
    expect(result.report.ambiguousRelations).toEqual([
      { type: "collegue", target: "Charles Babbage" }
    ]);
    expect(result.report.photoReferences).toEqual(["https://example.com/ada.webp"]);
  });

  it("deduplicates repeated tags, relationships and photo references during mapping", () => {
    const result = mapNotionPage({
      pageId: "page-dedupe",
      properties: {
        Prenom: "Ada",
        Nom: "Lovelace",
        Tags: ["Famille", "Famille", "Tech"],
        V6: ["Analia Cruz", "Analia Cruz"],
        Relations: [
          { type: "couple", target: "Grace Hopper" },
          { type: "couple", target: "Grace Hopper" }
        ],
        "Père relation": ["Victor Lovelace", "Victor Lovelace"],
        Photo: ["https://example.com/ada.webp", "https://example.com/ada.webp"]
      }
    });

    expect(result.mapped.tags).toEqual(["Famille", "Tech"]);
    expect(result.mapped.photoReferences).toEqual(["https://example.com/ada.webp"]);
    expect(result.mapped.relationships).toEqual([
      { type: "couple", target: "Grace Hopper" },
      { type: "previous_character", target: "Analia Cruz" },
      { type: "parent", target: "Victor Lovelace" }
    ]);
  });

  it("maps Flashback status, police fields and group tags from Notion properties", () => {
    const aliveResult = mapNotionPage({
      pageId: "page-heitor",
      properties: {
        Prenom: "Heitor Leite",
        Nom: "JR",
        "Statut vital": "En vie",
        Date: "12/02/2026",
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
        Date: "2026-02-12",
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
      deathOrDepartureDate: null,
      isRpDeath: false,
      policeRank: "Rookie",
      policeBadgeNumber: "99",
      tags: []
    });
    expect(deceasedResult.mapped).toMatchObject({
      lifeStatus: "deceased",
      deathOrDepartureDate: "2026-02-12",
      isRpDeath: true,
      policeRank: "Député 2",
      policeBadgeNumber: "110",
      tags: []
    });
    expect(groupResult.mapped.tags).toEqual(["Richman Lane", "6block"]);
    expect(groupResult.mapped.policeRank).toBeNull();
    expect(groupResult.mapped.policeBadgeNumber).toBeNull();
    expect(deceasedResult.report.recognizedFields).toEqual(
      expect.arrayContaining(["Date", "Famille", "Groupes", "Statut vital"])
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
        tags: ["Famille", "Tech"],
        photoReferences: ["https://secure.notion-static.com/ada-avatar.webp"]
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
      photoReferences: ["https://secure.notion-static.com/ada-avatar.webp"],
      sourceUrl: "https://example.com/page-ada"
    });
  });
});
