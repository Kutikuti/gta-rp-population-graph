import type {
  AdminNotionImportBatch,
  AdminNotionImportEntry,
  LifeStatus,
  VerificationStatus
} from "../api";
import { ApiRequestError } from "../api";
import { lifeStatusLabels, verificationLabels } from "../constants";

export const notionImportStatusLabels: Record<AdminNotionImportEntry["status"], string> = {
  new: "Nouveau",
  updated: "Modifié",
  unchanged: "Inchangé",
  missing: "Absent",
  failed: "Erreur"
};

export const notionImportStatusOptions: Array<AdminNotionImportEntry["status"] | "all"> = [
  "all",
  "failed",
  "new",
  "updated",
  "unchanged",
  "missing"
];

export const notionImportAppliedOptions = ["all", "pending", "applied"] as const;
export type NotionImportAppliedFilter = (typeof notionImportAppliedOptions)[number];

export const countImportBatch = (batch: AdminNotionImportBatch, key: string) =>
  batch.totals[key] ?? 0;

export const jsonPreview = (value: unknown) => JSON.stringify(value, null, 2);

export const snapshotString = (snapshot: Record<string, unknown>, key: string) =>
  typeof snapshot[key] === "string" && snapshot[key].trim() ? snapshot[key].trim() : null;

export const formatNotionLifeStatus = (value: string | null) =>
  value ? (lifeStatusLabels[value as LifeStatus] ?? value) : "-";

export const formatNotionVerificationStatus = (snapshot: Record<string, unknown>) => {
  const value = snapshotString(snapshot, "verificationStatus");

  return value ? (verificationLabels[value as VerificationStatus] ?? value) : "-";
};

export const notionImportApplyErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return "La fiche importée n'a pas pu être appliquée.";
  }

  switch (error.code) {
    case "NOTION_IMPORT_ENTRY_NOT_APPLICABLE":
      return "Cette entrée est en erreur ou absente de la source, elle ne peut pas être appliquée.";
    case "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT":
      return "Le snapshot mappé est incomplet. Corrige d'abord le mapping.";
    case "NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER":
      return "Plusieurs fiches existantes correspondent déjà à ce nom. Le rattachement manuel sera nécessaire.";
    case "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS":
      return "Certaines relations restent ambiguës. Le rattachement automatique a été bloqué pour éviter une mauvaise liaison.";
    case "NOTION_IMPORT_ENTRY_NOT_FOUND":
      return "Cette entrée d'import n'existe plus.";
    default:
      return error.message || "La fiche importée n'a pas pu être appliquée.";
  }
};

export const notionImportPhotoErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return "La photo Notion n'a pas pu être importée.";
  }

  switch (error.code) {
    case "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY":
      return "Applique d'abord la fiche avant d'importer sa photo.";
    case "NOTION_IMPORT_ENTRY_NO_PHOTO":
      return "Cette fiche importée ne contient pas de photo exploitable.";
    case "NOTION_IMPORT_ENTRY_INVALID_PHOTO":
      return error.message || "La photo distante a été refusée par le pipeline de sécurité.";
    case "NOTION_IMPORT_ENTRY_NOT_FOUND":
      return "Cette entrée d'import n'existe plus.";
    default:
      return error.message || "La photo Notion n'a pas pu être importée.";
  }
};
