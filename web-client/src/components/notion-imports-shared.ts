import type {
  AdminNotionImportBatch,
  AdminNotionImportEntry,
  LifeStatus,
  VerificationStatus
} from "../api";
import { lifeStatusLabels, verificationLabels } from "../constants";
import { apiErrorMessage } from "./api-error-shared";

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
  return apiErrorMessage(error, "La fiche importée n'a pas pu être appliquée.", {
    NOTION_IMPORT_ENTRY_NOT_APPLICABLE:
      "Cette entrée est en erreur ou absente de la source, elle ne peut pas être appliquée.",
    NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT:
      "Le snapshot mappé est incomplet. Corrige d'abord le mapping.",
    NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER:
      "Plusieurs fiches existantes correspondent déjà à ce nom. Le rattachement manuel sera nécessaire.",
    NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS:
      "Certaines relations restent ambiguës. Le rattachement automatique a été bloqué pour éviter une mauvaise liaison.",
    NOTION_IMPORT_ENTRY_NOT_FOUND: "Cette entrée d'import n'existe plus."
  });
};

export const notionImportPhotoErrorMessage = (error: unknown) => {
  return apiErrorMessage(error, "La photo Notion n'a pas pu être importée.", {
    NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY:
      "Applique d'abord la fiche avant d'importer sa photo.",
    NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT:
      "Le snapshot mappé est incomplet. Corrige d'abord le mapping.",
    NOTION_IMPORT_ENTRY_NO_PHOTO: "Cette fiche importée ne contient pas de photo exploitable.",
    NOTION_IMPORT_ENTRY_INVALID_PHOTO:
      "La photo distante a été refusée par le pipeline de sécurité.",
    NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND:
      "Le personnage lié à cette fiche importée est introuvable.",
    NOTION_IMPORT_ENTRY_NOT_FOUND: "Cette entrée d'import n'existe plus."
  });
};
