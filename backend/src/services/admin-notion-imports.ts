import { Op } from "sequelize";

import { models, sequelize } from "../db/index.js";
import type { Character, JsonObject } from "../db/models/index.js";
import {
  loadCharacterTags,
  refreshAppliedBatchRelationships,
  relationshipsForCharacter,
  resolveOrCreateStreamerId,
  resolveOrCreateTags,
  resolveRelationshipTargets,
  syncCharacterTags,
  syncImportedRelationships
} from "./admin-notion-imports-persistence.js";
import { importNotionImportEntryPhoto as importNotionImportEntryPhotoMutation } from "./admin-notion-imports-photo.js";
import {
  type AdminNotionImportApplyResult,
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportPhotoResult,
  importCandidateFromEntry,
  serializeImportBatch,
  serializeImportEntry,
  setChange
} from "./admin-notion-imports-shared.js";
import { logAdminAction } from "./admin-shared.js";
import { generateUniqueCharacterSlug } from "./character-slug.js";

export class SequelizeAdminNotionImportService {
  async listNotionImports(): Promise<AdminNotionImportBatch[]> {
    const batches = await models.NotionImportBatch.findAll({
      order: [["createdAt", "DESC"]],
      limit: 20
    });

    return batches.map(serializeImportBatch);
  }

  async getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null> {
    const batch = await models.NotionImportBatch.findByPk(batchId);

    if (!batch) {
      return null;
    }

    const entries = await models.NotionImportEntry.findAll({
      where: { batchId },
      order: [
        ["status", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    return {
      batch: serializeImportBatch(batch),
      entries: entries.map(serializeImportEntry)
    };
  }

  async applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportApplyResult> {
    return sequelize.transaction(async (transaction) => {
      const entry = await models.NotionImportEntry.findOne({
        where: {
          batchId: input.batchId,
          sourcePageId: input.pageId
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!entry) {
        return { status: "not_found" };
      }

      if (entry.status === "failed" || entry.status === "missing") {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_NOT_APPLICABLE",
          message: "Cette entrée d'import ne peut pas être appliquée telle quelle."
        };
      }

      const candidate = importCandidateFromEntry(entry);

      if (!candidate) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT",
          message: "Le snapshot mappé est incomplet ou invalide."
        };
      }

      let character: Character | null = null;
      let created = false;
      let currentStreamerSocialLinks: Record<string, string> | null = null;

      if (entry.appliedCharacterId) {
        character = await models.Character.findByPk(entry.appliedCharacterId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
      }

      if (!character) {
        const matches = await models.Character.findAll({
          where: {
            firstName: { [Op.iLike]: candidate.firstName },
            lastName: { [Op.iLike]: candidate.lastName }
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (matches.length > 1) {
          return {
            status: "invalid",
            code: "NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER",
            message:
              "Plusieurs fiches existantes portent déjà ce nom. Le rattachement automatique est bloqué.",
            details: {
              fullName: `${candidate.firstName} ${candidate.lastName}`,
              characterIds: matches.map((match) => match.id)
            }
          };
        }

        character = matches[0] ?? null;
      }

      const currentTags = character ? await loadCharacterTags(character.id, transaction) : [];
      const currentTagNames = currentTags
        .map((tag) => tag.name)
        .sort((left, right) => left.localeCompare(right, "fr"));
      const currentRelationshipSummary = character
        ? await relationshipsForCharacter(character.id, transaction)
        : [];

      if (!character) {
        created = true;
        character = await models.Character.create(
          {
            publicSlug: await generateUniqueCharacterSlug(
              candidate.firstName,
              candidate.lastName,
              transaction
            ),
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            nickname: candidate.nickname,
            birthDate: null,
            lifeStatus: candidate.lifeStatus,
            deathOrDepartureDate: candidate.deathOrDepartureDate,
            photoUrl: null,
            companyName: candidate.companyName,
            companyRank: candidate.companyRank,
            companyBadgeNumber: candidate.companyBadgeNumber,
            phoneNumbers: candidate.phoneNumbers,
            streamerId: null,
            groupName: candidate.groupName,
            district: candidate.district,
            isRpDeath: candidate.isRpDeath,
            previousCharacters: candidate.previousCharacters,
            verificationStatus: candidate.verificationStatus,
            sourceNote: candidate.sourceNote,
            dataSource: "notion"
          },
          { transaction }
        );
      } else if (character.streamerId) {
        const streamer = await models.Streamer.findByPk(character.streamerId, {
          attributes: ["socialLinks"],
          transaction
        });

        currentStreamerSocialLinks = streamer?.socialLinks ?? null;
      }

      const resolvedRelationships = await resolveRelationshipTargets(
        character.id,
        candidate.relationships,
        transaction
      );

      if (resolvedRelationships.ambiguous.length > 0) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS",
          message:
            "Certaines relations n'ont pas pu être rattachées de façon fiable. La fiche n'a pas été appliquée.",
          details: {
            ambiguous: resolvedRelationships.ambiguous
          }
        };
      }

      const tagEntities = await resolveOrCreateTags(candidate.tags, transaction);
      const streamerId = await resolveOrCreateStreamerId(
        candidate.streamerPublicName,
        candidate.verificationStatus,
        candidate.socialLinks,
        transaction
      );
      const nextTagNames = tagEntities
        .map((tag) => tag.name)
        .sort((left, right) => left.localeCompare(right, "fr"));
      const nextRelationshipSummary = resolvedRelationships.resolved
        .map((relationship) => ({
          type: relationship.type,
          target: relationship.targetName
        }))
        .sort((left, right) =>
          `${left.type}:${left.target}`.localeCompare(`${right.type}:${right.target}`, "fr")
        );
      const changes: JsonObject = {};

      setChange(changes, "firstName", created ? null : character.firstName, candidate.firstName);
      setChange(changes, "lastName", created ? null : character.lastName, candidate.lastName);
      setChange(changes, "nickname", created ? null : character.nickname, candidate.nickname);
      setChange(changes, "lifeStatus", created ? null : character.lifeStatus, candidate.lifeStatus);
      setChange(
        changes,
        "deathOrDepartureDate",
        created ? null : character.deathOrDepartureDate,
        candidate.deathOrDepartureDate
      );
      setChange(
        changes,
        "phoneNumbers",
        created ? [] : (character.phoneNumbers ?? []),
        candidate.phoneNumbers
      );
      setChange(
        changes,
        "companyName",
        created ? null : character.companyName,
        candidate.companyName
      );
      setChange(
        changes,
        "companyRank",
        created ? null : character.companyRank,
        candidate.companyRank
      );
      setChange(
        changes,
        "companyBadgeNumber",
        created ? null : character.companyBadgeNumber,
        candidate.companyBadgeNumber
      );
      setChange(changes, "groupName", created ? null : character.groupName, candidate.groupName);
      setChange(changes, "district", created ? null : character.district, candidate.district);
      setChange(changes, "isRpDeath", created ? null : character.isRpDeath, candidate.isRpDeath);
      setChange(
        changes,
        "previousCharacters",
        created ? null : character.previousCharacters,
        candidate.previousCharacters
      );
      setChange(
        changes,
        "verificationStatus",
        created ? null : character.verificationStatus,
        candidate.verificationStatus
      );
      setChange(changes, "sourceNote", created ? null : character.sourceNote, candidate.sourceNote);
      setChange(
        changes,
        "socialLinks",
        created ? null : currentStreamerSocialLinks,
        candidate.socialLinks
      );
      setChange(changes, "tags", currentTagNames, nextTagNames);
      setChange(changes, "relationships", currentRelationshipSummary, nextRelationshipSummary);

      await character.update(
        {
          publicSlug:
            created ||
            character.firstName !== candidate.firstName ||
            character.lastName !== candidate.lastName
              ? await generateUniqueCharacterSlug(
                  candidate.firstName,
                  candidate.lastName,
                  transaction,
                  character.id
                )
              : character.publicSlug,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          nickname: candidate.nickname,
          lifeStatus: candidate.lifeStatus,
          deathOrDepartureDate: candidate.deathOrDepartureDate,
          companyName: candidate.companyName,
          companyRank: candidate.companyRank,
          companyBadgeNumber: candidate.companyBadgeNumber,
          phoneNumbers: candidate.phoneNumbers,
          streamerId,
          groupName: candidate.groupName,
          district: candidate.district,
          isRpDeath: candidate.isRpDeath,
          previousCharacters: candidate.previousCharacters,
          verificationStatus: candidate.verificationStatus,
          sourceNote: candidate.sourceNote,
          dataSource: "notion"
        },
        { transaction }
      );

      await syncCharacterTags(character.id, tagEntities, transaction);
      await syncImportedRelationships(
        character.id,
        resolvedRelationships.resolved,
        candidate.verificationStatus,
        transaction
      );
      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: null,
          moderatorId: input.actorUserId,
          changes
        },
        { transaction }
      );
      await entry.update(
        {
          appliedCharacterId: character.id,
          appliedByUserId: input.actorUserId,
          appliedAt: new Date()
        },
        { transaction }
      );
      await refreshAppliedBatchRelationships(input.batchId, transaction);
      await logAdminAction(
        input.actorUserId,
        {
          action: "notion-import.apply-entry",
          targetType: "notion_import_entry",
          targetId: entry.id,
          changes: {
            batchId: input.batchId,
            pageId: input.pageId,
            characterId: character.id,
            created,
            unresolvedRelationships: resolvedRelationships.unresolved
          }
        },
        transaction
      );

      const reloadedEntry = await models.NotionImportEntry.findByPk(entry.id, { transaction });

      if (!reloadedEntry) {
        throw new Error(`Notion import entry ${entry.id} could not be reloaded after apply.`);
      }

      return {
        status: "applied",
        entry: serializeImportEntry(reloadedEntry),
        characterId: character.id,
        created
      };
    });
  }

  async importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportPhotoResult> {
    return importNotionImportEntryPhotoMutation(input);
  }
}

export type {
  AdminNotionImportApplyResult,
  AdminNotionImportBatch,
  AdminNotionImportDetail,
  AdminNotionImportPhotoResult
};
