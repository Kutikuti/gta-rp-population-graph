import type { Transaction } from "sequelize";

import { models } from "../db/index.js";
import type { ChangeRequest, Character, JsonObject } from "../db/models/index.js";
import type { CharacterSnapshot } from "./change-request-schemas.js";
import {
  applySnapshot,
  type ChangeDiff,
  calculateCharacterCreationDiff,
  calculateCharacterDiff,
  characterToSnapshot,
  prepareSnapshotForWrite
} from "./change-request-snapshots.js";
import { generateUniqueCharacterSlug } from "./character-slug.js";

const createCharacterFromSnapshot = async (
  snapshot: CharacterSnapshot,
  transaction: Transaction
) => {
  const character = await models.Character.create(
    {
      publicSlug: await generateUniqueCharacterSlug(
        snapshot.firstName,
        snapshot.lastName,
        transaction
      ),
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
      streamerId: null,
      socialLinks: snapshot.socialLinks,
      groupName: snapshot.groupName,
      district: snapshot.district,
      isRpDeath: snapshot.isRpDeath,
      previousCharacters: snapshot.previousCharacters,
      verificationStatus: snapshot.verificationStatus,
      sourceNote: snapshot.sourceNote,
      dataSource: "contribution"
    },
    { transaction }
  );

  await applySnapshot(character, snapshot, "contribution", transaction);

  return character;
};

const loadTargetCharacterForApproval = async (
  request: ChangeRequest,
  transaction: Transaction
): Promise<Character | null> => {
  if (request.requestType === "create") {
    return null;
  }

  if (!request.characterId) {
    return null;
  }

  return models.Character.findByPk(request.characterId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  });
};

export const approvePendingChangeRequest = async (input: {
  moderatorId: string;
  proposedSnapshot: CharacterSnapshot;
  request: ChangeRequest;
  transaction: Transaction;
}): Promise<{
  character: Character;
  changes: ChangeDiff;
  preparedSnapshot: CharacterSnapshot;
} | null> => {
  const preparedSnapshot = await prepareSnapshotForWrite(input.proposedSnapshot);
  const creationChanges =
    input.request.requestType === "create"
      ? calculateCharacterCreationDiff(preparedSnapshot)
      : null;

  let character = await loadTargetCharacterForApproval(input.request, input.transaction);

  if (input.request.requestType === "create") {
    character = await createCharacterFromSnapshot(preparedSnapshot, input.transaction);
  }

  if (!character) {
    return null;
  }

  const changes =
    creationChanges ??
    calculateCharacterDiff(
      await characterToSnapshot(character, input.transaction),
      preparedSnapshot
    );

  if (input.request.requestType === "update") {
    await applySnapshot(character, preparedSnapshot, "contribution", input.transaction);
  }

  await models.ChangeHistory.create(
    {
      characterId: character.id,
      changeRequestId: input.request.id,
      moderatorId: input.moderatorId,
      changes
    },
    { transaction: input.transaction }
  );

  await input.request.update(
    {
      status: "approved",
      characterId: character.id,
      proposedSnapshot: preparedSnapshot as unknown as JsonObject,
      reviewerId: input.moderatorId,
      resolvedAt: new Date()
    },
    { transaction: input.transaction }
  );

  return { character, changes, preparedSnapshot };
};

export const applyDirectCharacterEdit = async (input: {
  character: Character;
  moderatorId: string;
  snapshot: CharacterSnapshot;
  transaction: Transaction;
}): Promise<{ characterId: string; changes: ChangeDiff }> => {
  const currentSnapshot = await characterToSnapshot(input.character, input.transaction);
  const preparedSnapshot = await prepareSnapshotForWrite(input.snapshot);
  const changes = calculateCharacterDiff(currentSnapshot, preparedSnapshot);

  await applySnapshot(input.character, preparedSnapshot, "moderation", input.transaction);
  await models.ChangeHistory.create(
    {
      characterId: input.character.id,
      changeRequestId: null,
      moderatorId: input.moderatorId,
      changes
    },
    { transaction: input.transaction }
  );

  return { characterId: input.character.id, changes };
};
