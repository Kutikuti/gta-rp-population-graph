import type { LifeStatus, RelationshipType, VerificationStatus } from "../db/enums.js";
import type {
  Character,
  JsonObject,
  NotionImportBatch,
  NotionImportEntry
} from "../db/models/index.js";
import { type NotionImportPreviewItem, previewNotionImportEntry } from "./notion-import.js";

export type AdminNotionImportBatch = {
  id: string;
  sourceName: string;
  status: string;
  sourceSnapshot: JsonObject;
  totals: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotionImportEntry = NotionImportPreviewItem & {
  rawContent: JsonObject;
  mappedSnapshot: JsonObject;
  mappingReport: JsonObject;
  appliedCharacterId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type AdminNotionImportDetail = {
  batch: AdminNotionImportBatch;
  entries: AdminNotionImportEntry[];
};

export type AdminNotionImportApplyResult =
  | { status: "applied"; entry: AdminNotionImportEntry; characterId: string; created: boolean }
  | { status: "not_found" }
  | { status: "invalid"; code: string; message: string; details?: JsonObject };

export type AdminNotionImportPhotoResult =
  | { status: "imported"; entry: AdminNotionImportEntry; characterId: string; photoUrl: string }
  | { status: "not_found" }
  | { status: "invalid"; code: string; message: string; details?: JsonObject };

export type ImportRelationshipDraft = {
  type: RelationshipType;
  targetName: string;
};

export type ImportEntryCandidate = {
  firstName: string;
  lastName: string;
  nickname: string | null;
  lifeStatus: LifeStatus;
  deathOrDepartureDate: string | null;
  phoneNumber: string | null;
  streamerPublicName: string | null;
  socialLinks: Record<string, string> | null;
  companyName: string | null;
  companyRank: string | null;
  companyBadgeNumber: string | null;
  groupName: string | null;
  district: string | null;
  isRpDeath: boolean;
  previousCharacters: JsonObject | null;
  verificationStatus: VerificationStatus;
  sourceNote: string | null;
  tags: string[];
  relationships: ImportRelationshipDraft[];
  photoReferences: string[];
};

const relationshipTypes = new Set<RelationshipType>([
  "parent",
  "child",
  "sibling",
  "couple",
  "previous_character",
  "couple_reference",
  "aunt_or_uncle_reference",
  "ex_partner_reference",
  "uncle_reference",
  "aunt_reference"
]);

export const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

export const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const booleanValue = (value: unknown) => value === true;

export const stringListValue = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

export const jsonRecordValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entryValue]) => entryValue !== null)
  ) as JsonObject;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right, "fr")
    );

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
};

export const setChange = (
  changes: JsonObject,
  key: string,
  oldValue: unknown,
  newValue: unknown
) => {
  if (stableJson(oldValue) === stableJson(newValue)) {
    return;
  }

  changes[key] = { old: oldValue, new: newValue };
};

export const characterFullName = (character: Pick<Character, "firstName" | "lastName">) =>
  `${character.firstName} ${character.lastName}`;

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();

export const serializeImportBatch = (batch: NotionImportBatch): AdminNotionImportBatch => ({
  id: batch.id,
  sourceName: batch.sourceName,
  status: batch.status,
  sourceSnapshot: batch.sourceSnapshot,
  totals:
    batch.report && typeof batch.report === "object" && "totals" in batch.report
      ? ((batch.report as { totals?: Record<string, number> }).totals ?? {})
      : {},
  createdAt: batch.createdAt.toISOString(),
  updatedAt: batch.updatedAt.toISOString()
});

export const serializeImportEntry = (entry: NotionImportEntry): AdminNotionImportEntry => ({
  ...previewNotionImportEntry(entry),
  rawContent: entry.rawContent,
  mappedSnapshot: entry.mappedSnapshot,
  mappingReport: entry.mappingReport,
  appliedCharacterId: entry.appliedCharacterId,
  appliedAt: isoDate(entry.appliedAt),
  createdAt: entry.createdAt.toISOString()
});

export const importCandidateFromEntry = (entry: NotionImportEntry): ImportEntryCandidate | null => {
  const snapshot = entry.mappedSnapshot as Record<string, unknown>;
  const firstName = stringValue(snapshot.firstName);
  const lastName = stringValue(snapshot.lastName);
  const verificationStatus = stringValue(snapshot.verificationStatus) as VerificationStatus | null;
  const lifeStatus = stringValue(snapshot.lifeStatus) as LifeStatus | null;

  if (!firstName || !lastName || !verificationStatus || !lifeStatus) {
    return null;
  }

  const relationships = Array.isArray(snapshot.relationships)
    ? snapshot.relationships.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }

        const type = stringValue((item as Record<string, unknown>).type);
        const targetName = stringValue((item as Record<string, unknown>).target);

        if (!type || !targetName || !relationshipTypes.has(type as RelationshipType)) {
          return [];
        }

        return [{ type: type as RelationshipType, targetName }];
      })
    : [];

  const socialLinksRecord = jsonRecordValue(snapshot.socialLinks);

  return {
    firstName,
    lastName,
    nickname: stringValue(snapshot.nickname),
    lifeStatus,
    deathOrDepartureDate: stringValue(snapshot.deathOrDepartureDate),
    phoneNumber: stringValue(snapshot.phoneNumber),
    streamerPublicName: stringValue(snapshot.streamerPublicName),
    socialLinks:
      socialLinksRecord && Object.keys(socialLinksRecord).length > 0
        ? (socialLinksRecord as Record<string, string>)
        : null,
    companyName: stringValue(snapshot.companyName),
    companyRank: stringValue(snapshot.companyRank),
    companyBadgeNumber: stringValue(snapshot.companyBadgeNumber),
    groupName: stringValue(snapshot.groupName),
    district: stringValue(snapshot.district),
    isRpDeath: booleanValue(snapshot.isRpDeath),
    previousCharacters: jsonRecordValue(snapshot.previousCharacters),
    verificationStatus,
    sourceNote: stringValue(snapshot.sourceNote),
    tags: stringListValue(snapshot.tags),
    relationships,
    photoReferences: stringListValue(snapshot.photoReferences)
  };
};
