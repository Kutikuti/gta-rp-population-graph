import { createHash } from "node:crypto";

import { z } from "zod";

import type { NotionImportEntryStatus } from "../db/enums.js";
import type { JsonObject } from "../db/models/index.js";
import type { NotionPageInput } from "./notion-import-schema.js";

const stringList = z.union([z.string(), z.array(z.string())]).optional();

const twitchHandleFromUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      return null;
    }

    const [firstSegment] = url.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!firstSegment || firstSegment.startsWith("@")) {
      return firstSegment ? firstSegment.slice(1) : null;
    }

    return firstSegment;
  } catch {
    return null;
  }
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
  const explicitStreamerPublicName = stringValue(
    findValue(properties, fieldAliases.streamerPublicName)
  );
  const fallbackTwitchHandle = twitchHandleFromUrl(socialLinks.twitch);

  const mapped: MappedNotionCharacter = {
    firstName,
    lastName,
    nickname: stringValue(findValue(properties, fieldAliases.nickname)),
    lifeStatus,
    deathOrDepartureDate:
      lifeStatus === "deceased" || lifeStatus === "left" ? deathOrDepartureDate : null,
    phoneNumber: stringValue(findValue(properties, fieldAliases.phoneNumber)),
    streamerPublicName: explicitStreamerPublicName ?? fallbackTwitchHandle,
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
