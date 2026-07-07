import { Op, type Transaction } from "sequelize";

import type { VerificationStatus } from "../db/enums.js";
import { models } from "../db/index.js";
import type { Character, SocialLinks, Tag } from "../db/models/index.js";
import {
  characterFullName,
  type ImportRelationshipDraft,
  importCandidateFromEntry,
  normalizeText
} from "./admin-notion-imports-shared.js";
import {
  canonicalRelationshipKey,
  canonicalRelationshipRecord,
  relationshipDirection,
  relationshipLabel,
  relationshipTypeForCharacterView
} from "./character-relationships.js";
import { resolveOrCreateStreamer } from "./streamer-links.js";

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
    .map((relationship) => {
      const type = relationshipTypeForCharacterView(
        relationship.type,
        relationship.direction,
        relationship.sourceCharacterId,
        characterId
      );

      return {
        type,
        target:
          relationship.sourceCharacterId === characterId
            ? relationship.targetCharacter
              ? characterFullName(relationship.targetCharacter)
              : relationship.targetCharacterId
            : relationship.sourceCharacter
              ? characterFullName(relationship.sourceCharacter)
              : relationship.sourceCharacterId
      };
    })
    .filter((relationship, index, items) => {
      return (
        items.findIndex(
          (candidate) =>
            candidate.type === relationship.type && candidate.target === relationship.target
        ) === index
      );
    })
    .sort((left, right) =>
      `${left.type}:${left.target}`.localeCompare(`${right.type}:${right.target}`, "fr")
    );
};

export const resolveOrCreateStreamerId = async (
  streamerPublicName: string | null,
  verificationStatus: VerificationStatus,
  socialLinks: SocialLinks | null,
  transaction: Transaction
) => {
  return resolveOrCreateStreamer({
    streamerPublicName,
    socialLinks,
    verificationStatus,
    transaction
  });
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
          canonicalRelationshipKey(
            candidate.type,
            relationshipDirection(candidate.type),
            characterId,
            candidate.targetCharacterId
          ) ===
          canonicalRelationshipKey(
            relationship.type,
            relationshipDirection(relationship.type),
            characterId,
            relationship.targetCharacterId
          )
      ) === index
    );
  });

  if (uniqueRelationships.length === 0) {
    return;
  }

  const canonicalRelationships = uniqueRelationships.map((relationship) => {
    const direction = relationshipDirection(relationship.type);
    const canonical = canonicalRelationshipRecord(
      relationship.type,
      direction,
      characterId,
      relationship.targetCharacterId
    );

    return {
      relationship,
      canonical,
      key: canonicalRelationshipKey(
        relationship.type,
        direction,
        characterId,
        relationship.targetCharacterId
      )
    };
  });

  const relationshipTypesToCheck = [
    ...new Set(canonicalRelationships.map(({ canonical }) => canonical.type))
  ];
  const targetCharacterIds = [
    ...new Set(uniqueRelationships.map((relationship) => relationship.targetCharacterId))
  ];
  const existingKeys = new Set<string>();

  if (relationshipTypesToCheck.length > 0 && targetCharacterIds.length > 0) {
    const existingRelationships = await models.CharacterRelationship.findAll({
      attributes: ["sourceCharacterId", "targetCharacterId", "type", "direction"],
      where: {
        type: {
          [Op.in]: relationshipTypesToCheck
        },
        [Op.or]: [
          {
            sourceCharacterId: characterId,
            targetCharacterId: {
              [Op.in]: targetCharacterIds
            }
          },
          {
            targetCharacterId: characterId,
            sourceCharacterId: {
              [Op.in]: targetCharacterIds
            }
          }
        ]
      },
      transaction
    });

    for (const relationship of existingRelationships) {
      existingKeys.add(
        canonicalRelationshipKey(
          relationship.type,
          relationship.direction,
          relationship.sourceCharacterId,
          relationship.targetCharacterId
        )
      );
    }
  }

  const relationshipsToCreate = canonicalRelationships.filter(({ key }) => !existingKeys.has(key));

  if (relationshipsToCreate.length === 0) {
    return;
  }

  await models.CharacterRelationship.bulkCreate(
    relationshipsToCreate.map(({ canonical }) => {
      return {
        sourceCharacterId: canonical.sourceCharacterId,
        targetCharacterId: canonical.targetCharacterId,
        type: canonical.type,
        direction: canonical.direction,
        label: relationshipLabel(canonical.type),
        description: null,
        source: "notion",
        verificationStatus
      };
    }),
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
