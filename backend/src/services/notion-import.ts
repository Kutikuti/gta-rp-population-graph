import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import type { NotionImportEntryStatus } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import type { JsonObject, NotionImportBatch, NotionImportEntry } from "../db/models/index.js";

const stringList = z.union([z.string(), z.array(z.string())]).optional();

const notionPageSchema = z.object({
  pageId: z.string().min(1),
  url: z.string().url().optional(),
  properties: z.record(z.string(), z.unknown()).default({})
});

const notionImportInputSchema = z.object({
  sourceName: z.string().min(1).default("Notion communautaire"),
  sourceUrl: z.string().url().optional(),
  fullSource: z.boolean().default(true),
  pages: z.array(notionPageSchema).min(1)
});

export type NotionPageInput = z.infer<typeof notionPageSchema>;
export type NotionImportInput = z.infer<typeof notionImportInputSchema>;

export type PreviousNotionImportEntry = {
  sourcePageId: string;
  contentHash: string;
  rawContent: JsonObject;
};

export type MappedNotionCharacter = {
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  lifeStatus: "alive" | "deceased" | "left" | "unknown";
  deathOrDepartureDate: string | null;
  phoneNumber: string | null;
  streamerPublicName: string | null;
  socialLinks: JsonObject;
  businessName: string | null;
  groupName: string | null;
  groupRole: string | null;
  district: string | null;
  isRpDeath: boolean;
  policeRank: string | null;
  policeBadgeNumber: string | null;
  previousCharacters: JsonObject;
  tags: string[];
  relationships: JsonObject[];
  photoReferences: string[];
  dataSource: "notion";
  verificationStatus: "imported" | "to_check";
  sourceNote: string;
};

export type NotionEntryMappingReport = {
  recognizedFields: string[];
  missingFields: string[];
  unknownFields: string[];
  ambiguousRelations: JsonObject[];
  photoReferences: string[];
  errors: string[];
};

export type PlannedNotionImportEntry = {
  sourcePageId: string;
  sourceUrl: string | null;
  rawContent: JsonObject;
  contentHash: string;
  previousContentHash: string | null;
  status: NotionImportEntryStatus;
  mappedSnapshot: JsonObject;
  mappingReport: NotionEntryMappingReport;
};

export type NotionImportReport = {
  sourceName: string;
  sourceUrl: string | null;
  generatedAt: string;
  totals: Record<NotionImportEntryStatus, number>;
  entries: Array<{
    sourcePageId: string;
    status: NotionImportEntryStatus;
    recognizedFields: string[];
    missingFields: string[];
    unknownFields: string[];
    errors: string[];
  }>;
  warnings: string[];
  publishesPublicData: false;
};

export type PlannedNotionImport = {
  sourceName: string;
  sourceSnapshot: JsonObject;
  entries: PlannedNotionImportEntry[];
  report: NotionImportReport;
};

export type StoredNotionImport = {
  batch: NotionImportBatch;
  report: NotionImportReport;
};

export type NotionImportPreviewItem = {
  status: NotionImportEntryStatus;
  pageId: string;
  fullName: string;
  lifeStatus: string | null;
  streamer: string | null;
  twitch: string | null;
  business: string | null;
  group: string | null;
  tags: string;
  photoReferences: string[];
  sourceUrl: string | null;
};

const fieldAliases = {
  firstName: ["prenom", "prénom", "firstName", "first_name", "first name"],
  lastName: ["nom", "lastName", "last_name", "last name"],
  nickname: ["surnom", "nickname", "alias"],
  lifeStatus: ["statut", "statut vital", "lifeStatus", "life_status"],
  deathOrDepartureDate: [
    "date",
    "date de mort",
    "date de mort rp",
    "date de décès",
    "date de deces",
    "date de départ",
    "date de depart",
    "deathOrDepartureDate",
    "death_or_departure_date"
  ],
  phoneNumber: ["telephone", "téléphone", "phone", "phoneNumber", "phone_number"],
  streamerPublicName: ["streamer", "streameur", "streamerPublicName"],
  businessName: ["métier/entreprise", "metier/entreprise", "entreprise", "businessName"],
  groupName: ["groupes", "groupe", "groupName"],
  groupRole: ["rôle", "role", "groupRole"],
  district: ["quartier", "district"],
  twitch: ["twitch"],
  kick: ["kick"],
  youtube: ["youtube", "youTube"],
  instagram: ["instagram"],
  tiktok: ["tiktok", "tikTok"],
  policeRank: ["grade police", "rang police", "poste", "policeRank", "police_rank"],
  policeBadgeNumber: ["matricule police", "matricule", "policeBadgeNumber", "police_badge_number"],
  previousCharacters: [
    "anciens personnages",
    "previousCharacters",
    "previous_characters",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5"
  ],
  legacyCharacterLinks: ["v6"],
  parentRelationships: [
    "est parent",
    "père relation",
    "pere relation",
    "mère relation",
    "mere relation"
  ],
  siblingRelationships: [
    "frères/soeurs relation",
    "freres/soeurs relation",
    "frères/soeurs relations",
    "freres/soeurs relations",
    "frères/sœurs relation",
    "freres/sœurs relation",
    "frères/sœurs relations",
    "freres/sœurs relations"
  ],
  informativeCoupleRelationships: ["couple relation"],
  informativeAuntOrUncleRelationships: ["est oncle/tante"],
  informativeExRelationships: ["ex/exs relation"],
  informativeUncleRelationships: ["oncle relation"],
  informativeAuntRelationships: ["tante relation"],
  familyName: ["famille"],
  tags: ["tags", "tag"],
  relationships: ["relations", "relationships", "parentes rp", "parentés rp"],
  photoReferences: ["photo", "image", "avatar", "photoUrl", "photo_url"]
} as const;

const allAliases = new Set(
  Object.values(fieldAliases)
    .flat()
    .map((value) => value.toLowerCase())
);
const technicalImportFields = new Set(["titre notion"]);

const normalizeKey = (value: string) => value.trim().toLowerCase();

const uniqueStrings = (values: string[]) => [...new Set(values)];

const stringValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const findValue = (properties: Record<string, unknown>, aliases: readonly string[]) => {
  const entries = Object.entries(properties);
  const aliasSet = new Set(aliases.map(normalizeKey));
  return entries.find(([key]) => aliasSet.has(normalizeKey(key)))?.[1];
};

const listValue = (value: unknown): string[] => {
  const parsed = stringList.safeParse(value);

  if (!parsed.success || parsed.data === undefined) {
    return [];
  }

  const values = Array.isArray(parsed.data) ? parsed.data : parsed.data.split(",");
  return uniqueStrings(values.map((item) => item.trim()).filter(Boolean));
};

const withoutEmptyNotionValues = (values: string[]) =>
  values.filter((value) => {
    const normalized = value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase();

    return !["aucun groupe", "aucun groupes", "aucune groupe", "aucune groupes"].includes(
      normalized
    );
  });

const isPoliceBusiness = (value: string | null) => {
  if (!value) {
    return false;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return /\b(sasp|sasd|lspd|bcso|police|sheriff)\b/.test(normalized);
};

const relationshipListValue = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) {
    const text = stringValue(value);

    if (!text) {
      return [];
    }

    return text
      .split(/[;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const match = item.match(/^([^:：-]{1,40})\s*[:：-]\s*(.+)$/);

        if (!match) {
          return { raw: item };
        }

        return {
          type: match[1]?.trim().toLowerCase(),
          target: match[2]?.trim()
        };
      });
  }

  return value.filter((item): item is JsonObject => {
    return typeof item === "object" && item !== null && !Array.isArray(item);
  });
};

const mapLifeStatus = (value: unknown): MappedNotionCharacter["lifeStatus"] => {
  const raw = stringValue(value)
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (!raw) {
    return "unknown";
  }

  if (["vivant", "vivante", "en vie", "alive"].includes(raw)) {
    return "alive";
  }

  if (
    ["mort", "morte", "mort/morte", "decede", "decedee", "decede/decedee", "deceased"].includes(raw)
  ) {
    return "deceased";
  }

  if (["parti", "depart", "départ", "left"].includes(raw)) {
    return "left";
  }

  return "unknown";
};

const dateValue = (value: unknown): string | null => {
  const raw = stringValue(value);

  if (!raw || raw === "‣") {
    return null;
  }

  const isoDate = raw.match(/\b\d{4}-\d{2}-\d{2}\b/u)?.[0];

  if (isoDate) {
    return isoDate;
  }

  const frenchDate = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/u);

  if (!frenchDate) {
    return null;
  }

  const [, day, month, year] = frenchDate;

  if (!day || !month || !year) {
    return null;
  }

  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${paddedMonth}-${paddedDay}`;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
};

export const hashNotionRawContent = (value: JsonObject) =>
  createHash("sha256").update(stableJson(value)).digest("hex");

const recognizedFieldNames = (properties: Record<string, unknown>) =>
  Object.keys(properties)
    .filter((key) => allAliases.has(normalizeKey(key)))
    .sort();

const unknownFieldNames = (properties: Record<string, unknown>) =>
  Object.keys(properties)
    .filter((key) => {
      const normalizedKey = normalizeKey(key);
      return !allAliases.has(normalizedKey) && !technicalImportFields.has(normalizedKey);
    })
    .sort();

const ambiguousRelationships = (relationships: JsonObject[]) =>
  relationships.filter((relationship) => {
    const type = stringValue(relationship.type);
    const target = stringValue(relationship.target) ?? stringValue(relationship.name);
    return (
      !type ||
      !target ||
      ![
        "parent",
        "enfant",
        "child",
        "fratrie",
        "sibling",
        "couple",
        "previous_character",
        "couple_reference",
        "aunt_or_uncle_reference",
        "ex_partner_reference",
        "uncle_reference",
        "aunt_reference",
        "ancien personnage",
        "anciens personnages"
      ].includes(type)
    );
  });

const relationshipEntriesFromField = (value: unknown, type: string) =>
  listValue(value).map(
    (target) =>
      ({
        type,
        target
      }) as JsonObject
  );

const previousCharacterRelationshipList = (value: unknown) =>
  relationshipEntriesFromField(value, "previous_character");

const dedupeRelationships = (relationships: JsonObject[]) => {
  const seen = new Set<string>();

  return relationships.filter((relationship) => {
    const type = stringValue(relationship.type) ?? "";
    const target = stringValue(relationship.target) ?? stringValue(relationship.name) ?? "";
    const key = `${type.toLowerCase()}::${target.toLowerCase()}`;

    if (!type || !target || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const mapNotionPage = (page: NotionPageInput) => {
  const properties = page.properties;
  const firstName = stringValue(findValue(properties, fieldAliases.firstName));
  const lastName = stringValue(findValue(properties, fieldAliases.lastName));
  const businessName = stringValue(findValue(properties, fieldAliases.businessName));
  const groupName = stringValue(findValue(properties, fieldAliases.groupName));
  const previousCharacterLinks = listValue(
    findValue(properties, fieldAliases.legacyCharacterLinks)
  );
  const relationships = dedupeRelationships([
    ...relationshipListValue(findValue(properties, fieldAliases.relationships)),
    ...previousCharacterRelationshipList(findValue(properties, fieldAliases.legacyCharacterLinks)),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.parentRelationships),
      "parent"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.siblingRelationships),
      "sibling"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.informativeCoupleRelationships),
      "couple_reference"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.informativeAuntOrUncleRelationships),
      "aunt_or_uncle_reference"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.informativeExRelationships),
      "ex_partner_reference"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.informativeUncleRelationships),
      "uncle_reference"
    ),
    ...relationshipEntriesFromField(
      findValue(properties, fieldAliases.informativeAuntRelationships),
      "aunt_reference"
    )
  ]);
  const photoReferences = uniqueStrings(
    listValue(findValue(properties, fieldAliases.photoReferences))
  );
  const lifeStatus = mapLifeStatus(findValue(properties, fieldAliases.lifeStatus));
  const deathOrDepartureDate = dateValue(findValue(properties, fieldAliases.deathOrDepartureDate));
  const explicitTags = listValue(findValue(properties, fieldAliases.tags));
  const groupTags = withoutEmptyNotionValues(listValue(groupName));
  const explicitPoliceRank = stringValue(
    findValue(properties, ["grade police", "rang police", "policeRank", "police_rank"])
  );
  const genericPost = stringValue(findValue(properties, ["poste"]));
  const explicitPoliceBadgeNumber = stringValue(
    findValue(properties, ["matricule police", "policeBadgeNumber", "police_badge_number"])
  );
  const genericBadgeNumber = stringValue(findValue(properties, ["matricule"]));
  const shouldMapGenericPoliceFields = isPoliceBusiness(businessName);
  const missingFields = [firstName ? null : "firstName", lastName ? null : "lastName"].filter(
    (field): field is string => Boolean(field)
  );
  const errors = missingFields.map((field) => `Champ obligatoire absent: ${field}`);
  const socialLinks = {
    twitch: stringValue(findValue(properties, fieldAliases.twitch)),
    kick: stringValue(findValue(properties, fieldAliases.kick)),
    youtube: stringValue(findValue(properties, fieldAliases.youtube)),
    instagram: stringValue(findValue(properties, fieldAliases.instagram)),
    tiktok: stringValue(findValue(properties, fieldAliases.tiktok))
  };
  const cleanSocialLinks = Object.fromEntries(
    Object.entries(socialLinks).filter(([, value]) => value)
  ) as JsonObject;

  const mapped: MappedNotionCharacter = {
    firstName,
    lastName,
    nickname: stringValue(findValue(properties, fieldAliases.nickname)),
    lifeStatus,
    deathOrDepartureDate:
      lifeStatus === "deceased" || lifeStatus === "left" ? deathOrDepartureDate : null,
    phoneNumber: stringValue(findValue(properties, fieldAliases.phoneNumber)),
    streamerPublicName: stringValue(findValue(properties, fieldAliases.streamerPublicName)),
    socialLinks: cleanSocialLinks,
    businessName,
    groupName,
    groupRole: stringValue(findValue(properties, fieldAliases.groupRole)),
    district: stringValue(findValue(properties, fieldAliases.district)),
    isRpDeath: lifeStatus === "deceased",
    policeRank: explicitPoliceRank ?? (shouldMapGenericPoliceFields ? genericPost : null),
    policeBadgeNumber:
      explicitPoliceBadgeNumber ?? (shouldMapGenericPoliceFields ? genericBadgeNumber : null),
    previousCharacters: {
      raw: findValue(properties, fieldAliases.previousCharacters) ?? null,
      v6: previousCharacterLinks
    },
    tags: uniqueStrings(explicitTags.length > 0 ? explicitTags : groupTags),
    relationships,
    photoReferences,
    dataSource: "notion",
    verificationStatus: errors.length > 0 ? "to_check" : "imported",
    sourceNote: `Import Notion communautaire, page ${page.pageId}.`
  };

  const report: NotionEntryMappingReport = {
    recognizedFields: recognizedFieldNames(properties),
    missingFields,
    unknownFields: unknownFieldNames(properties),
    ambiguousRelations: ambiguousRelationships(relationships),
    photoReferences,
    errors
  };

  return { mapped, report };
};

const emptyTotals = (): Record<NotionImportEntryStatus, number> => ({
  new: 0,
  updated: 0,
  unchanged: 0,
  missing: 0,
  failed: 0
});

export const buildNotionImportPlan = (
  input: NotionImportInput,
  previousEntries: PreviousNotionImportEntry[],
  now = new Date()
): PlannedNotionImport => {
  const previousByPageId = new Map(
    previousEntries.map((entry) => [entry.sourcePageId, entry] as const)
  );
  const seenPageIds = new Set<string>();
  const entries: PlannedNotionImportEntry[] = [];

  for (const page of input.pages) {
    const rawContent = {
      pageId: page.pageId,
      url: page.url ?? null,
      properties: page.properties
    };
    const contentHash = hashNotionRawContent(rawContent);
    const previous = previousByPageId.get(page.pageId);
    const mapping = mapNotionPage(page);
    const status: NotionImportEntryStatus = previous
      ? previous.contentHash === contentHash
        ? "unchanged"
        : "updated"
      : "new";
    const finalStatus = mapping.report.errors.length > 0 ? "failed" : status;

    entries.push({
      sourcePageId: page.pageId,
      sourceUrl: page.url ?? null,
      rawContent,
      contentHash,
      previousContentHash: previous?.contentHash ?? null,
      status: finalStatus,
      mappedSnapshot: mapping.mapped,
      mappingReport: mapping.report
    });
    seenPageIds.add(page.pageId);
  }

  if (input.fullSource) {
    for (const previous of previousEntries) {
      if (seenPageIds.has(previous.sourcePageId)) {
        continue;
      }

      entries.push({
        sourcePageId: previous.sourcePageId,
        sourceUrl: null,
        rawContent: previous.rawContent,
        contentHash: previous.contentHash,
        previousContentHash: previous.contentHash,
        status: "missing",
        mappedSnapshot: {},
        mappingReport: {
          recognizedFields: [],
          missingFields: [],
          unknownFields: [],
          ambiguousRelations: [],
          photoReferences: [],
          errors: ["Page absente de la source complete relancee."]
        }
      });
    }
  }

  const totals = emptyTotals();

  for (const entry of entries) {
    totals[entry.status] += 1;
  }

  const report: NotionImportReport = {
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl ?? null,
    generatedAt: now.toISOString(),
    totals,
    entries: entries.map((entry) => ({
      sourcePageId: entry.sourcePageId,
      status: entry.status,
      recognizedFields: entry.mappingReport.recognizedFields,
      missingFields: entry.mappingReport.missingFields,
      unknownFields: entry.mappingReport.unknownFields,
      errors: entry.mappingReport.errors
    })),
    warnings: [
      "Rapport de travail uniquement: aucune donnee publique n'est publiee par cet import.",
      "Les references de photos Notion ne sont pas telechargees automatiquement."
    ],
    publishesPublicData: false
  };

  return {
    sourceName: input.sourceName,
    sourceSnapshot: {
      sourceUrl: input.sourceUrl ?? null,
      fullSource: input.fullSource,
      pageCount: input.pages.length,
      generatedAt: now.toISOString()
    },
    entries,
    report
  };
};

const latestEntriesByPageId = async (): Promise<PreviousNotionImportEntry[]> => {
  const rows = await models.NotionImportEntry.findAll({
    order: [
      ["sourcePageId", "ASC"],
      ["lastSeenAt", "DESC"],
      ["createdAt", "DESC"]
    ]
  });
  const latest = new Map<string, PreviousNotionImportEntry>();

  for (const row of rows) {
    if (latest.has(row.sourcePageId) || row.status === "missing") {
      continue;
    }

    latest.set(row.sourcePageId, {
      sourcePageId: row.sourcePageId,
      contentHash: row.contentHash,
      rawContent: row.rawContent
    });
  }

  return [...latest.values()];
};

export class SequelizeNotionImportService {
  async importFromInput(input: unknown): Promise<StoredNotionImport> {
    const parsed = notionImportInputSchema.parse(input);
    const previousEntries = await latestEntriesByPageId();
    const now = new Date();
    const plan = buildNotionImportPlan(parsed, previousEntries, now);

    return sequelize.transaction(async (transaction) => {
      const hasFailedEntries = plan.entries.some((entry) => entry.status === "failed");
      const batch = await models.NotionImportBatch.create(
        {
          sourceName: plan.sourceName,
          sourceSnapshot: plan.sourceSnapshot,
          status: hasFailedEntries ? "failed" : "reported",
          report: plan.report,
          validatedByUserId: null,
          validatedAt: null
        },
        { transaction }
      );

      await models.NotionImportEntry.bulkCreate(
        plan.entries.map((entry) => ({
          batchId: batch.id,
          sourcePageId: entry.sourcePageId,
          sourceUrl: entry.sourceUrl,
          rawContent: entry.rawContent,
          contentHash: entry.contentHash,
          previousContentHash: entry.previousContentHash,
          status: entry.status,
          mappedSnapshot: entry.mappedSnapshot,
          mappingReport: entry.mappingReport,
          lastSeenAt: now
        })),
        { transaction }
      );

      return { batch, report: plan.report };
    });
  }
}

export const loadNotionImportInputFile = async (path: string): Promise<NotionImportInput> => {
  const content = await readFile(path, "utf8");
  return notionImportInputSchema.parse(JSON.parse(content));
};

const reportEntriesByPredicate = (
  report: NotionImportReport,
  predicate: (entry: NotionImportReport["entries"][number]) => boolean
) => report.entries.filter(predicate);

const uniqueSorted = (values: string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const formatNotionImportSummary = (
  input: {
    batchId: string;
    scrapedPages?: number;
    report: NotionImportReport;
  },
  options: { detailLimit?: number } = {}
) => {
  const detailLimit = options.detailLimit ?? 12;
  const { report } = input;
  const errorEntries = reportEntriesByPredicate(report, (entry) => entry.errors.length > 0);
  const unknownEntries = reportEntriesByPredicate(
    report,
    (entry) => entry.unknownFields.length > 0
  );
  const missingEntries = reportEntriesByPredicate(report, (entry) => entry.status === "missing");
  const unknownFields = uniqueSorted(unknownEntries.flatMap((entry) => entry.unknownFields));
  const lines = [
    `Import Notion: ${report.sourceName}`,
    `Batch: ${input.batchId}`,
    `Source: ${report.sourceUrl ?? "non renseignee"}`,
    `Pages scrapees: ${input.scrapedPages ?? report.entries.length}`,
    `Statuts: new=${report.totals.new}, updated=${report.totals.updated}, unchanged=${report.totals.unchanged}, missing=${report.totals.missing}, failed=${report.totals.failed}`
  ];

  if (errorEntries.length > 0) {
    lines.push("");
    lines.push(`Erreurs (${errorEntries.length}) :`);
    lines.push(
      ...errorEntries
        .slice(0, detailLimit)
        .map((entry) => `- ${entry.sourcePageId}: ${entry.errors.join(" ; ")}`)
    );

    if (errorEntries.length > detailLimit) {
      lines.push(`- ... ${errorEntries.length - detailLimit} autres erreurs`);
    }
  }

  if (unknownFields.length > 0) {
    lines.push("");
    lines.push(`Champs inconnus (${unknownFields.length}) : ${unknownFields.join(", ")}`);
  }

  if (missingEntries.length > 0) {
    lines.push("");
    lines.push(`Pages absentes de la source (${missingEntries.length}) :`);
    lines.push(...missingEntries.slice(0, detailLimit).map((entry) => `- ${entry.sourcePageId}`));

    if (missingEntries.length > detailLimit) {
      lines.push(`- ... ${missingEntries.length - detailLimit} autres pages absentes`);
    }
  }

  lines.push("");
  lines.push("Publication publique: non");
  lines.push(...report.warnings.map((warning) => `Attention: ${warning}`));

  return lines.join("\n");
};

const snapshotString = (snapshot: JsonObject, key: string) => {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const snapshotStringRecord = (snapshot: JsonObject, key: string) => {
  const value = snapshot[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

export const previewNotionImportEntry = (
  entry: Pick<NotionImportEntry, "status" | "sourcePageId" | "sourceUrl" | "mappedSnapshot">
): NotionImportPreviewItem => {
  const snapshot = entry.mappedSnapshot;
  const socialLinks = snapshotStringRecord(snapshot, "socialLinks");
  const tags = Array.isArray(snapshot.tags)
    ? snapshot.tags.filter((tag): tag is string => typeof tag === "string").join(", ")
    : "";
  const photoReferences = Array.isArray(snapshot.photoReferences)
    ? snapshot.photoReferences.filter(
        (reference): reference is string => typeof reference === "string"
      )
    : [];
  const firstName = snapshotString(snapshot, "firstName");
  const lastName = snapshotString(snapshot, "lastName");

  return {
    status: entry.status,
    pageId: entry.sourcePageId,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || "(nom incomplet)",
    lifeStatus: snapshotString(snapshot, "lifeStatus"),
    streamer: snapshotString(snapshot, "streamerPublicName"),
    twitch: typeof socialLinks.twitch === "string" ? socialLinks.twitch : null,
    business: snapshotString(snapshot, "businessName"),
    group: snapshotString(snapshot, "groupName"),
    tags,
    photoReferences,
    sourceUrl: entry.sourceUrl
  };
};
