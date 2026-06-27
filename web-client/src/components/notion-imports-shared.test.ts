import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../api";
import {
  notionImportApplyErrorMessage,
  notionImportPhotoErrorMessage
} from "./notion-imports-shared";

describe("notion import error messages", () => {
  it("maps unresolved relationship errors to a specific apply message", () => {
    const error = new ApiRequestError(
      "Certaines relations n'ont pas pu être rattachées de façon fiable.",
      409,
      "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS"
    );

    expect(notionImportApplyErrorMessage(error)).toContain("Certaines relations restent ambiguës");
  });

  it("maps missing applied character errors to a specific photo message", () => {
    const error = new ApiRequestError(
      "Le personnage lié à cette fiche importée est introuvable.",
      404,
      "NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND"
    );

    expect(notionImportPhotoErrorMessage(error)).toBe(
      "Le personnage lié à cette fiche importée est introuvable."
    );
  });

  it("maps invalid snapshot photo errors to the mapping correction message", () => {
    const error = new ApiRequestError(
      "Le snapshot mappé est incomplet.",
      400,
      "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT"
    );

    expect(notionImportPhotoErrorMessage(error)).toBe(
      "Le snapshot mappé est incomplet. Corrige d'abord le mapping."
    );
  });
});
