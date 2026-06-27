import { Op, type Transaction } from "sequelize";

import type { VerificationStatus } from "../db/enums.js";
import { models } from "../db/index.js";
import type { Character, Tag } from "../db/models/index.js";
import {
  characterFullName,
  type ImportRelationshipDraft,
  importCandidateFromEntry,
  normalizeText
} from "./admin-notion-imports-shared.js";
import { relationshipDirection, relationshipLabel } from "./character-relationships.js";

const DEFAULT_TAG_COLOR = "#2f9bff";

export const relationshipsForCharacter = async (characterId: string, transaction: Transaction) => {
  const relationships = await models.CharacterRelationship.findAll({
    where: {
      [Op.or]: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }]
    },
    include: [
      {
        model: models.Character,
        as: "sourceCharacter",
        attributes: ["id", "firstName", "lastName"]
      },
      {
        model: models.Character,
        as: "targetCharacter",
        attributes: ["id", "firstName", "lastName"]
      }
    ],
    transaction
  });

  return relationships
    .map((relationship) => ({
      type: relationship.type,
      target:
        relationship.sourceCharacterId === characterId
          ? relationship.targetCharacter
            ? characterFullName(relationship.targetCharacter)
            : relationship.targetCharacterId
          : relationship.sourceCharacter
            ? characterFullName(relationship.sourceCharacter)
            : relationship.sourceCharacterId
    }))
    .sort((left, right) =>
      `${left.type}:${left.target}`.localeCompare(`${right.type}:${right.target}`, "fr")
    );
};

export const resolveOrCreateStreamerId = async (
  streamerPublicName: string | null,
  verificationStatus: VerificationStatus,
  transaction: Transaction
) => {
  if (!streamerPublicName) {
    return null;
  }

  const existing = await models.Streamer.findOne({
    attributes: ["id"],
    where: {
      publicName: {
        [Op.iLike]: streamerPublicName
      }
    },
    transaction
  });

  if (existing) {
    return existing.id;
  }

  const created = await models.Streamer.create(
    {
      publicName: streamerPublicName,
      primaryPlatform: null,
      socialLinks: null,
      verificationStatus
    },
    { transaction }
  );

  return created.id;
};

export const resolveOrCreateTags = async (tagNames: string[], transaction: Transaction) => {
  const uniqueNames = [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];

  if (uniqueNames.length === 0) {
    return [];
  }

  const existingTags = await models.Tag.findAll({
    where: {
      [Op.or]: uniqueNames.map((name) => ({
        name: {
          [Op.iLike]: name
        }
      }))
    },
    transaction
  });

  const tagsByName = new Map(existingTags.map((tag) => [normalizeText(tag.name), tag] as const));
  const resolved: Tag[] = [...existingTags];

  for (const name of uniqueNames) {
    if (tagsByName.has(normalizeText(name))) {
      continue;
    }

    const created = await models.Tag.create(
      {
        name,
        type: "other",
        colorHex: DEFAULT_TAG_COLOR,
        description: null
      },
      { transaction }
    );

    tagsByName.set(normalizeText(created.name), created);
    resolved.push(created);
  }

  return resolved.sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

export const syncCharacterTags = async (
  characterId: string,
  tags: Tag[],
  transaction: Transaction
) => {
  await models.CharacterTag.destroy({
    where: { characterId },
    transaction
  });

  if (tags.length === 0) {
    return;
  }

  await models.CharacterTag.bulkCreate(
    tags.map((tag) => ({
      characterId,
      tagId: tag.id
    })),
    { transaction }
  );
};

export const loadCharacterTags = async (characterId: string, transaction: Transaction) => {
  const character = await models.Character.findByPk(characterId, {
    include: [{ model: models.Tag, as: "tags", through: { attributes: [] } }],
    transaction
  });

  return character?.tags ?? [];
};

export const resolveRelationshipTargets = async (
  characterId: string,
  relationships: ImportRelationshipDraft[],
  transaction: Transaction
) => {
  const characters = await models.Character.findAll({
    attributes: ["id", "firstName", "lastName"],
    transaction
  });
  const byFullName = new Map<string, Character[]>();

  for (const character of characters) {
    const key = normalizeText(characterFullName(character));
    const current = byFullName.get(key) ?? [];
    current.push(character);
    byFullName.set(key, current);
  }

  const resolved: Array<ImportRelationshipDraft & { targetCharacterId: string }> = [];
  const unresolved: string[] = [];
  const ambiguous: string[] = [];

  for (const relationship of relationships) {
    const matches = byFullName.get(normalizeText(relationship.targetName)) ?? [];

    if (matches.length === 0) {
      unresolved.push(`${relationship.type}: ${relationship.targetName}`);
      continue;
    }

    if (matches.length > 1) {
      ambiguous.push(`${relationship.type}: ${relationship.targetName}`);
      continue;
    }

    const match = matches[0];

    if (!match || match.id === characterId) {
      continue;
    }

    resolved.push({
      ...relationship,
      targetCharacterId: match.id
    });
  }

  return { resolved, unresolved, ambiguous };
};

export const syncImportedRelationships = async (
  characterId: string,
  relationships: Array<ImportRelationshipDraft & { targetCharacterId: string }>,
  verificationStatus: VerificationStatus,
  transaction: Transaction
) => {
  await models.CharacterRelationship.destroy({
    where: {
      sourceCharacterId: characterId,
      source: "notion"
    },
    transaction
  });

  const uniqueRelationships = relationships.filter((relationship, index, array) => {
    return (
      array.findIndex(
        (candidate) =>
          candidate.type === relationship.type &&
          candidate.targetCharacterId === relationship.targetCharacterId
      ) === index
    );
  });

  if (uniqueRelationships.length === 0) {
    return;
  }

  const symmetricRelationships = uniqueRelationships.filter(
    (relationship) => relationshipDirection(relationship.type) === "symmetric"
  );
  const existingSymmetricKeys = new Set<string>();

  if (symmetricRelationships.length > 0) {
    const existingSymmetricRelationships = await models.CharacterRelationship.findAll({
      attributes: ["sourceCharacterId", "targetCharacterId", "type"],
      where: {
        type: {
          [Op.in]: [...new Set(symmetricRelationships.map((relationship) => relationship.type))]
        },
        [Op.or]: [
          {
            sourceCharacterId: characterId,
            targetCharacterId: {
              [Op.in]: symmetricRelationships.map((relationship) => relationship.targetCharacterId)
            }
          },
          {
            targetCharacterId: characterId,
            sourceCharacterId: {
              [Op.in]: symmetricRelationships.map((relationship) => relationship.targetCharacterId)
            }
          }
        ]
      },
      transaction
    });

    for (const relationship of existingSymmetricRelationships) {
      const pair = [relationship.sourceCharacterId, relationship.targetCharacterId]
        .sort((left, right) => left.localeCompare(right, "fr"))
        .join(":");
      existingSymmetricKeys.add(`${relationship.type}:${pair}`);
    }
  }

  const relationshipsToCreate = uniqueRelationships.filter((relationship) => {
    if (relationshipDirection(relationship.type) !== "symmetric") {
      return true;
    }

    const pair = [characterId, relationship.targetCharacterId]
      .sort((left, right) => left.localeCompare(right, "fr"))
      .join(":");

    return !existingSymmetricKeys.has(`${relationship.type}:${pair}`);
  });

  if (relationshipsToCreate.length === 0) {
    return;
  }

  await models.CharacterRelationship.bulkCreate(
    relationshipsToCreate.map((relationship) => ({
      sourceCharacterId: characterId,
      targetCharacterId: relationship.targetCharacterId,
      type: relationship.type,
      direction: relationshipDirection(relationship.type),
      label: relationshipLabel(relationship.type),
      description: null,
      source: "notion",
      verificationStatus
    })),
    { transaction }
  );
};

export const refreshAppliedBatchRelationships = async (
  batchId: string,
  transaction: Transaction
) => {
  const appliedEntries = await models.NotionImportEntry.findAll({
    where: {
      batchId,
      appliedCharacterId: {
        [Op.ne]: null
      }
    },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  for (const entry of appliedEntries) {
    if (!entry.appliedCharacterId) {
      continue;
    }

    const candidate = importCandidateFromEntry(entry);

    if (!candidate) {
      continue;
    }

    const resolvedRelationships = await resolveRelationshipTargets(
      entry.appliedCharacterId,
      candidate.relationships,
      transaction
    );

    if (resolvedRelationships.ambiguous.length > 0) {
      continue;
    }

    await syncImportedRelationships(
      entry.appliedCharacterId,
      resolvedRelationships.resolved,
      candidate.verificationStatus,
      transaction
    );
  }
};
