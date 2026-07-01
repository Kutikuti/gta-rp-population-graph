import { Op, type Transaction } from "sequelize";

import { type DataSource, editableRelationshipTypes } from "../db/enums.js";
import { models } from "../db/index.js";
import type {
  Character,
  CharacterRelationship,
  JsonObject,
  SocialLinks
} from "../db/models/index.js";
import { type CharacterSnapshot, characterSnapshotSchema } from "./change-request-schemas.js";
import { promoteCharacterPhotoIfPending } from "./character-photos.js";
import {
  invertRelationshipType,
  isEditableRelationshipType,
  relationshipDirection,
  relationshipLabel
} from "./character-relationships.js";
import { generateUniqueCharacterSlug } from "./character-slug.js";

type ChangeValue = string | boolean | JsonObject | JsonObject[] | SocialLinks | null;

export type FieldChange = {
  old: ChangeValue;
  new: ChangeValue;
};

export type ChangeDiff = Record<string, FieldChange>;

const editableFields = Object.keys(characterSnapshotSchema.shape) as Array<keyof CharacterSnapshot>;

export const normalizeRelationshipDrafts = (
  relationships: CharacterSnapshot["relationships"],
  currentCharacterId?: string
) => {
  const seen = new Set<string>();

  return relationships
    .filter((relationship) => relationship.characterId !== currentCharacterId)
    .filter((relationship) => {
      const key = `${relationship.type}:${relationship.characterId}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      `${left.type}:${left.characterId}`.localeCompare(`${right.type}:${right.characterId}`, "fr")
    );
};

const mapRelationshipToDraft = (
  relationship: CharacterRelationship,
  currentCharacterId: string
): CharacterSnapshot["relationships"][number] => {
  const type =
    relationship.direction === "directed" && relationship.sourceCharacterId !== currentCharacterId
      ? invertRelationshipType(relationship.type)
      : relationship.type;

  if (!isEditableRelationshipType(type)) {
    throw new Error(`Relationship type ${type} is not editable in character snapshots.`);
  }

  return {
    characterId:
      relationship.sourceCharacterId === currentCharacterId
        ? relationship.targetCharacterId
        : relationship.sourceCharacterId,
    type
  };
};

export const loadCharacterRelationshipDrafts = async (
  characterId: string,
  transaction?: Transaction
): Promise<CharacterSnapshot["relationships"]> => {
  const relationships = await models.CharacterRelationship.findAll({
    attributes: ["sourceCharacterId", "targetCharacterId", "type", "direction"],
    where: {
      type: {
        [Op.in]: editableRelationshipTypes
      },
      [Op.or]: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }]
    },
    transaction
  });

  return normalizeRelationshipDrafts(
    relationships.map((relationship) => mapRelationshipToDraft(relationship, characterId)),
    characterId
  );
};

export const characterToSnapshot = async (
  character: Character,
  transaction?: Transaction
): Promise<CharacterSnapshot> => {
  return {
    firstName: character.firstName,
    lastName: character.lastName,
    nickname: character.nickname,
    birthDate: character.birthDate,
    lifeStatus: character.lifeStatus,
    deathOrDepartureDate: character.deathOrDepartureDate,
    photoUrl: character.photoUrl,
    companyName: character.companyName,
    companyRank: character.companyRank,
    companyBadgeNumber: character.companyBadgeNumber,
    phoneNumbers: character.phoneNumbers ?? [],
    streamerId: character.streamerId,
    streamerName: null,
    socialLinks: character.socialLinks,
    groupName: character.groupName,
    district: character.district,
    isRpDeath: character.isRpDeath,
    relationships: await loadCharacterRelationshipDrafts(character.id, transaction),
    previousCharacters: character.previousCharacters as Record<string, string> | null,
    verificationStatus: character.verificationStatus,
    sourceNote: character.sourceNote
  };
};

const stableJson = (value: unknown) => JSON.stringify(value ?? null);

export const calculateCharacterDiff = (
  current: CharacterSnapshot,
  proposed: CharacterSnapshot
): ChangeDiff =>
  editableFields.reduce<ChangeDiff>((changes, field) => {
    const oldValue = current[field] as ChangeValue;
    const newValue = proposed[field] as ChangeValue;

    if (stableJson(oldValue) !== stableJson(newValue)) {
      changes[field] = {
        old: oldValue,
        new: newValue
      };
    }

    return changes;
  }, {});

export const calculateCharacterCreationDiff = (snapshot: CharacterSnapshot): ChangeDiff =>
  editableFields.reduce<ChangeDiff>((changes, field) => {
    const newValue = snapshot[field] as ChangeValue;

    if (stableJson(newValue) !== stableJson(null)) {
      changes[field] = {
        old: null,
        new: newValue
      };
    }

    return changes;
  }, {});

const resolveStreamerId = async (snapshot: CharacterSnapshot, transaction: Transaction) => {
  if (snapshot.streamerId) {
    const streamer = await models.Streamer.findByPk(snapshot.streamerId, {
      attributes: ["id"],
      transaction
    });

    if (!streamer) {
      throw new Error(`Streamer ${snapshot.streamerId} is missing.`);
    }

    return streamer.id;
  }

  if (!snapshot.streamerName) {
    return null;
  }

  const existing = await models.Streamer.findOne({
    attributes: ["id"],
    where: {
      publicName: {
        [Op.iLike]: snapshot.streamerName
      }
    },
    transaction
  });

  if (existing) {
    return existing.id;
  }

  const created = await models.Streamer.create(
    {
      publicName: snapshot.streamerName,
      primaryPlatform: null,
      socialLinks: null,
      verificationStatus: snapshot.verificationStatus
    },
    { transaction }
  );

  return created.id;
};

const applyRelationships = async (
  characterId: string,
  snapshot: CharacterSnapshot,
  source: DataSource,
  transaction: Transaction
) => {
  const relationships = normalizeRelationshipDrafts(snapshot.relationships, characterId);
  const relationshipIds = [
    ...new Set(relationships.map((relationship) => relationship.characterId))
  ];

  if (relationshipIds.length > 0) {
    const existingCharacters = await models.Character.findAll({
      attributes: ["id"],
      where: {
        id: {
          [Op.in]: relationshipIds
        }
      },
      transaction
    });

    if (existingCharacters.length !== relationshipIds.length) {
      throw new Error("A related character is missing.");
    }
  }

  await models.CharacterRelationship.destroy({
    where: {
      type: {
        [Op.in]: editableRelationshipTypes
      },
      [Op.or]: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }]
    },
    transaction
  });

  if (relationships.length === 0) {
    return;
  }

  await models.CharacterRelationship.bulkCreate(
    relationships.map((relationship) => ({
      sourceCharacterId: characterId,
      targetCharacterId: relationship.characterId,
      type: relationship.type,
      direction: relationshipDirection(relationship.type),
      label: relationshipLabel(relationship.type),
      description: null,
      source,
      verificationStatus: snapshot.verificationStatus
    })),
    { transaction }
  );
};

export const applySnapshot = async (
  character: Character,
  snapshot: CharacterSnapshot,
  source: DataSource,
  transaction: Transaction
) => {
  const streamerId = await resolveStreamerId(snapshot, transaction);
  const shouldRefreshPublicSlug =
    snapshot.firstName !== character.firstName || snapshot.lastName !== character.lastName;
  const publicSlug = shouldRefreshPublicSlug
    ? await generateUniqueCharacterSlug(
        snapshot.firstName,
        snapshot.lastName,
        transaction,
        character.id
      )
    : character.publicSlug;

  await character.update(
    {
      publicSlug,
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      nickname: snapshot.nickname,
      birthDate: snapshot.birthDate,
      lifeStatus: snapshot.lifeStatus,
      deathOrDepartureDate: snapshot.deathOrDepartureDate,
      photoUrl: snapshot.photoUrl,
      companyName: snapshot.companyName,
      companyRank: snapshot.companyRank,
      companyBadgeNumber: snapshot.companyBadgeNumber,
      phoneNumbers: snapshot.phoneNumbers,
      streamerId,
      socialLinks: snapshot.socialLinks,
      groupName: snapshot.groupName,
      district: snapshot.district,
      isRpDeath: snapshot.isRpDeath,
      previousCharacters: snapshot.previousCharacters,
      verificationStatus: snapshot.verificationStatus,
      sourceNote: snapshot.sourceNote,
      dataSource: source
    },
    { transaction }
  );

  await applyRelationships(character.id, snapshot, source, transaction);
};

export const prepareSnapshotForWrite = async (
  snapshot: CharacterSnapshot
): Promise<CharacterSnapshot> => ({
  ...snapshot,
  phoneNumbers: [...new Set(snapshot.phoneNumbers.map((value) => value.trim()).filter(Boolean))],
  relationships: normalizeRelationshipDrafts(snapshot.relationships),
  photoUrl: await promoteCharacterPhotoIfPending(snapshot.photoUrl)
});
