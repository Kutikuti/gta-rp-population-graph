import { models, sequelize } from "../db/index.js";
import {
  type AdminNotionImportPhotoResult,
  importCandidateFromEntry,
  serializeImportEntry
} from "./admin-notion-imports-shared.js";
import { logAdminAction } from "./admin-shared.js";
import {
  deleteStoredCharacterPhoto,
  InvalidCharacterPhotoError,
  importCharacterPhotoFromRemoteUrl
} from "./character-photos.js";

export const importNotionImportEntryPhoto = async (input: {
  actorUserId: string;
  batchId: string;
  pageId: string;
}): Promise<AdminNotionImportPhotoResult> => {
  const entry = await models.NotionImportEntry.findOne({
    where: {
      batchId: input.batchId,
      sourcePageId: input.pageId
    }
  });

  if (!entry) {
    return { status: "not_found" };
  }

  const candidate = importCandidateFromEntry(entry);

  if (!candidate) {
    return {
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT",
      message: "Le snapshot mappé est incomplet ou invalide."
    };
  }

  if (!entry.appliedCharacterId) {
    return {
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY",
      message: "Applique d'abord la fiche avant d'importer sa photo."
    };
  }

  const remotePhotoUrl = candidate.photoReferences[0];

  if (!remotePhotoUrl) {
    return {
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_NO_PHOTO",
      message: "Aucune photo exploitable n'a été trouvée dans cette fiche importée."
    };
  }

  let importedPhotoUrl: string;

  try {
    importedPhotoUrl = await importCharacterPhotoFromRemoteUrl({ url: remotePhotoUrl });
  } catch (error) {
    if (error instanceof InvalidCharacterPhotoError) {
      return {
        status: "invalid",
        code: "NOTION_IMPORT_ENTRY_INVALID_PHOTO",
        message: error.message
      };
    }

    throw error;
  }

  let previousPhotoUrlToDelete: string | null = null;

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const lockedEntry = await models.NotionImportEntry.findByPk(entry.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedEntry?.appliedCharacterId) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY",
          message: "Applique d'abord la fiche avant d'importer sa photo."
        } as const;
      }

      const character = await models.Character.findByPk(lockedEntry.appliedCharacterId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!character) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND",
          message: "Le personnage lié à cette fiche importée est introuvable."
        } as const;
      }

      const previousPhotoUrl = character.photoUrl;

      await character.update(
        {
          photoUrl: importedPhotoUrl
        },
        { transaction }
      );

      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: null,
          moderatorId: input.actorUserId,
          changes: {
            photoUrl: {
              old: previousPhotoUrl,
              new: importedPhotoUrl
            }
          }
        },
        { transaction }
      );

      await logAdminAction(
        input.actorUserId,
        {
          action: "notion-import.import-photo",
          targetType: "notion_import_entry",
          targetId: lockedEntry.id,
          changes: {
            batchId: input.batchId,
            pageId: input.pageId,
            characterId: character.id,
            remotePhotoUrl,
            photoUrl: importedPhotoUrl
          }
        },
        transaction
      );

      if (previousPhotoUrl && previousPhotoUrl !== importedPhotoUrl) {
        previousPhotoUrlToDelete = previousPhotoUrl;
      }

      return {
        status: "imported" as const,
        entry: serializeImportEntry(lockedEntry),
        characterId: character.id,
        photoUrl: importedPhotoUrl
      };
    });

    if (previousPhotoUrlToDelete) {
      await deleteStoredCharacterPhoto(previousPhotoUrlToDelete);
    }

    return result;
  } catch (error) {
    await deleteStoredCharacterPhoto(importedPhotoUrl);
    throw error;
  }
};
