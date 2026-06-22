import { Op, type Transaction } from "sequelize";
import { z } from "zod";

import {
  type changeRequestTypes,
  type DataSource,
  lifeStatuses,
  relationshipTypes,
  verificationStatuses
} from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import type {
  ChangeRequest,
  Character,
  CharacterRelationship,
  JsonObject,
  SocialLinks
} from "../db/models/index.js";
import {
  assertPendingCharacterPhotoExists,
  deletePendingCharacterPhoto,
  InvalidCharacterPhotoError,
  isPendingCharacterPhotoToken,
  promoteCharacterPhotoIfPending
} from "./character-photos.js";

const emptyToNull = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform(emptyToNull);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform(emptyToNull);

const socialLinksSchema = z
  .object({
    twitch: nullableText(300),
    kick: nullableText(300),
    youtube: nullableText(300),
    instagram: nullableText(300),
    tiktok: nullableText(300)
  })
  .strict()
  .nullable()
  .optional()
  .transform((value): SocialLinks | null => {
    if (!value) {
      return null;
    }

    const links: SocialLinks = {};

    for (const key of ["twitch", "kick", "youtube", "instagram", "tiktok"] as const) {
      const link = value[key];

      if (link) {
        links[key] = link;
      }
    }

    return Object.keys(links).length ? links : null;
  });

const previousCharactersSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(160))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const relationshipDraftSchema = z
  .object({
    characterId: z.uuid(),
    type: z.enum(relationshipTypes)
  })
  .strict();

export const characterSnapshotSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    nickname: nullableText(160),
    birthDate: dateOnly,
    lifeStatus: z.enum(lifeStatuses),
    deathOrDepartureDate: dateOnly,
    photoUrl: nullableText(600),
    businessName: nullableText(160),
    businessRank: nullableText(120),
    businessBadgeNumber: nullableText(80),
    phoneNumber: nullableText(40),
    streamerId: z
      .uuid()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    streamerName: nullableText(160),
    socialLinks: socialLinksSchema,
    groupName: nullableText(160),
    groupRole: nullableText(120),
    district: nullableText(120),
    isRpDeath: z.boolean().default(false),
    relationships: z.array(relationshipDraftSchema).default([]),
    policeRank: nullableText(120),
    policeBadgeNumber: nullableText(80),
    previousCharacters: previousCharactersSchema,
    verificationStatus: z.enum(verificationStatuses),
    sourceNote: nullableText(1000)
  })
  .strict();

export const changeRequestCreateSchema = z.object({
  characterId: z.uuid(),
  proposedSnapshot: characterSnapshotSchema
});

export const characterCreationContextSchema = z
  .object({
    q: nullableText(200),
    lifeStatus: nullableText(40),
    tag: nullableText(120),
    streamer: nullableText(160),
    verificationStatus: nullableText(40),
    matchTotal: z.number().int().min(0).max(100000).optional()
  })
  .strict();

export const characterCreationRequestSchema = z.object({
  proposedSnapshot: characterSnapshotSchema,
  searchContext: characterCreationContextSchema
});

export const moderationListSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional()
});

export const rejectChangeRequestSchema = z.object({
  comment: z.string().trim().min(1).max(1000)
});

export const directCharacterEditSchema = z.object({
  snapshot: characterSnapshotSchema
});

export type CharacterSnapshot = z.infer<typeof characterSnapshotSchema>;
export type CharacterCreationContext = z.infer<typeof characterCreationContextSchema>;

type ChangeValue = string | boolean | JsonObject | JsonObject[] | SocialLinks | null;

export type FieldChange = {
  old: ChangeValue;
  new: ChangeValue;
};

export type ChangeDiff = Record<string, FieldChange>;

export type ChangeRequestSummary = {
  id: string;
  requestType: (typeof changeRequestTypes)[number];
  characterId: string | null;
  characterName: string | null;
  proposedStreamerName: string | null;
  userId: string;
  userDisplayName: string | null;
  status: "pending" | "approved" | "rejected";
  proposedSnapshot: JsonObject;
  searchContext: JsonObject | null;
  reviewerId: string | null;
  reviewerDisplayName: string | null;
  moderatorComment: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface ChangeRequestService {
  createChangeRequest(input: {
    userId: string;
    characterId: string;
    proposedSnapshot: CharacterSnapshot;
  }): Promise<ChangeRequestSummary | null>;
  createCharacterCreationRequest(input: {
    userId: string;
    proposedSnapshot: CharacterSnapshot;
    searchContext: CharacterCreationContext;
  }): Promise<ChangeRequestSummary | "duplicate">;
  listUserChangeRequests(userId: string): Promise<ChangeRequestSummary[]>;
  listModerationChangeRequests(
    status?: ChangeRequestSummary["status"]
  ): Promise<ChangeRequestSummary[]>;
  getModerationChangeRequest(id: string): Promise<ChangeRequestSummary | null>;
  approveChangeRequest(input: {
    id: string;
    moderatorId: string;
  }): Promise<{ request: ChangeRequestSummary; changes: ChangeDiff } | null>;
  rejectChangeRequest(input: {
    id: string;
    moderatorId: string;
    comment: string;
  }): Promise<ChangeRequestSummary | null>;
  editCharacterDirectly(input: {
    characterId: string;
    moderatorId: string;
    snapshot: CharacterSnapshot;
  }): Promise<{ characterId: string; changes: ChangeDiff } | null>;
}

const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

const editableFields = Object.keys(characterSnapshotSchema.shape) as Array<keyof CharacterSnapshot>;

const relationshipLabelByType: Record<(typeof relationshipTypes)[number], string> = {
  parent: "Parent",
  child: "Enfant",
  sibling: "Fratrie",
  couple: "Couple"
};

const relationshipDirectionByType: Record<
  (typeof relationshipTypes)[number],
  "directed" | "symmetric"
> = {
  parent: "directed",
  child: "directed",
  sibling: "symmetric",
  couple: "symmetric"
};

const invertRelationshipType = (type: (typeof relationshipTypes)[number]) => {
  if (type === "parent") {
    return "child";
  }

  if (type === "child") {
    return "parent";
  }

  return type;
};

const normalizeRelationshipDrafts = (
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
): CharacterSnapshot["relationships"][number] => ({
  characterId:
    relationship.sourceCharacterId === currentCharacterId
      ? relationship.targetCharacterId
      : relationship.sourceCharacterId,
  type:
    relationship.direction === "directed" && relationship.sourceCharacterId !== currentCharacterId
      ? invertRelationshipType(relationship.type)
      : relationship.type
});

const loadCharacterRelationshipDrafts = async (
  characterId: string,
  transaction?: Transaction
): Promise<CharacterSnapshot["relationships"]> => {
  const relationships = await models.CharacterRelationship.findAll({
    attributes: ["sourceCharacterId", "targetCharacterId", "type", "direction"],
    where: {
      [Op.or]: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }]
    },
    transaction
  });

  return normalizeRelationshipDrafts(
    relationships.map((relationship) => mapRelationshipToDraft(relationship, characterId)),
    characterId
  );
};

const characterToSnapshot = async (
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
    businessName: character.businessName,
    businessRank: character.businessRank,
    businessBadgeNumber: character.businessBadgeNumber,
    phoneNumber: character.phoneNumber,
    streamerId: character.streamerId,
    streamerName: null,
    socialLinks: character.socialLinks,
    groupName: character.groupName,
    groupRole: character.groupRole,
    district: character.district,
    isRpDeath: character.isRpDeath,
    relationships: await loadCharacterRelationshipDrafts(character.id, transaction),
    policeRank: character.policeRank,
    policeBadgeNumber: character.policeBadgeNumber,
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

const extractProposedStreamerId = (request: ChangeRequest) => {
  const streamerId = request.proposedSnapshot.streamerId;

  return typeof streamerId === "string" && streamerId ? streamerId : null;
};

const buildProposedStreamerNameMap = async (requests: ChangeRequest[]) => {
  const streamerIds = [
    ...new Set(
      requests
        .map(extractProposedStreamerId)
        .filter((streamerId): streamerId is string => Boolean(streamerId))
    )
  ];

  if (streamerIds.length === 0) {
    return new Map<string, string>();
  }

  const streamers = await models.Streamer.findAll({
    attributes: ["id", "publicName"],
    where: {
      id: {
        [Op.in]: streamerIds
      }
    }
  });

  return new Map(streamers.map((streamer) => [streamer.id, streamer.publicName] as const));
};

const serializeChangeRequest = (
  request: ChangeRequest,
  proposedStreamerNames: ReadonlyMap<string, string>
): ChangeRequestSummary => ({
  id: request.id,
  requestType: request.requestType,
  characterId: request.characterId,
  characterName: request.character
    ? `${request.character.firstName} ${request.character.lastName}`
    : request.requestType === "create"
      ? `${String(request.proposedSnapshot.firstName)} ${String(request.proposedSnapshot.lastName)}`
      : null,
  proposedStreamerName: (() => {
    const streamerId = extractProposedStreamerId(request);
    const streamerName = request.proposedSnapshot.streamerName;

    if (typeof streamerName === "string" && streamerName.trim()) {
      return streamerName;
    }

    return streamerId ? (proposedStreamerNames.get(streamerId) ?? null) : null;
  })(),
  userId: request.userId,
  userDisplayName: request.user?.displayName ?? null,
  status: request.status,
  proposedSnapshot: request.proposedSnapshot,
  searchContext: request.searchContext,
  reviewerId: request.reviewerId,
  reviewerDisplayName: request.reviewer?.displayName ?? null,
  moderatorComment: request.moderatorComment,
  resolvedAt: isoDate(request.resolvedAt),
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString()
});

const serializeChangeRequests = async (requests: ChangeRequest[]) => {
  const proposedStreamerNames = await buildProposedStreamerNameMap(requests);

  return requests.map((request) => serializeChangeRequest(request, proposedStreamerNames));
};

const serializeSingleChangeRequest = async (request: ChangeRequest) => {
  const [summary] = await serializeChangeRequests([request]);

  return summary ?? null;
};

const requestInclude = [
  { association: "character", attributes: ["id", "firstName", "lastName"], required: false },
  { association: "user", attributes: ["id", "displayName"] },
  { association: "reviewer", attributes: ["id", "displayName"], required: false }
];

const reloadRequest = async (id: string, transaction?: Transaction) => {
  const request = await models.ChangeRequest.findByPk(id, {
    include: requestInclude,
    transaction
  });

  return request ? serializeSingleChangeRequest(request) : null;
};

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
  const relationshipIds = relationships.map((relationship) => relationship.characterId);

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
        [Op.in]: relationshipTypes
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
      direction: relationshipDirectionByType[relationship.type],
      label: relationshipLabelByType[relationship.type],
      description: null,
      source,
      verificationStatus: snapshot.verificationStatus
    })),
    { transaction }
  );
};

const applySnapshot = async (
  character: Character,
  snapshot: CharacterSnapshot,
  source: DataSource,
  transaction: Transaction
) => {
  const streamerId = await resolveStreamerId(snapshot, transaction);

  await character.update(
    {
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      nickname: snapshot.nickname,
      birthDate: snapshot.birthDate,
      lifeStatus: snapshot.lifeStatus,
      deathOrDepartureDate: snapshot.deathOrDepartureDate,
      photoUrl: snapshot.photoUrl,
      businessName: snapshot.businessName,
      businessRank: snapshot.businessRank,
      businessBadgeNumber: snapshot.businessBadgeNumber,
      phoneNumber: snapshot.phoneNumber,
      streamerId,
      socialLinks: snapshot.socialLinks,
      groupName: snapshot.groupName,
      groupRole: snapshot.groupRole,
      district: snapshot.district,
      isRpDeath: snapshot.isRpDeath,
      policeRank: snapshot.policeRank,
      policeBadgeNumber: snapshot.policeBadgeNumber,
      previousCharacters: snapshot.previousCharacters,
      verificationStatus: snapshot.verificationStatus,
      sourceNote: snapshot.sourceNote,
      dataSource: source
    },
    { transaction }
  );

  await applyRelationships(character.id, snapshot, source, transaction);
};

const prepareSnapshotForWrite = async (
  snapshot: CharacterSnapshot
): Promise<CharacterSnapshot> => ({
  ...snapshot,
  relationships: normalizeRelationshipDrafts(snapshot.relationships),
  photoUrl: await promoteCharacterPhotoIfPending(snapshot.photoUrl)
});

const calculateCharacterCreationDiff = (snapshot: CharacterSnapshot): ChangeDiff =>
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

const hasExactNameDuplicate = async (snapshot: CharacterSnapshot) => {
  const firstName = snapshot.firstName.trim();
  const lastName = snapshot.lastName.trim();

  const duplicate = await models.Character.findOne({
    attributes: ["id"],
    where: {
      firstName: { [Op.iLike]: firstName },
      lastName: { [Op.iLike]: lastName }
    }
  });

  return Boolean(duplicate);
};

export class SequelizeChangeRequestService implements ChangeRequestService {
  async createChangeRequest(input: {
    userId: string;
    characterId: string;
    proposedSnapshot: CharacterSnapshot;
  }): Promise<ChangeRequestSummary | null> {
    const character = await models.Character.findByPk(input.characterId, { attributes: ["id"] });

    if (!character) {
      return null;
    }

    const photoUrl = input.proposedSnapshot.photoUrl;

    if (isPendingCharacterPhotoToken(photoUrl)) {
      await assertPendingCharacterPhotoExists(photoUrl, input.userId);
    }

    const request = await models.ChangeRequest.create({
      userId: input.userId,
      requestType: "update",
      characterId: input.characterId,
      proposedSnapshot: input.proposedSnapshot as unknown as JsonObject,
      searchContext: null,
      status: "pending",
      reviewerId: null,
      moderatorComment: null,
      resolvedAt: null
    });

    return reloadRequest(request.id);
  }

  async createCharacterCreationRequest(input: {
    userId: string;
    proposedSnapshot: CharacterSnapshot;
    searchContext: CharacterCreationContext;
  }): Promise<ChangeRequestSummary | "duplicate"> {
    if (input.proposedSnapshot.photoUrl) {
      throw new InvalidCharacterPhotoError(
        "La photo est disponible uniquement sur une fiche existante."
      );
    }

    if (await hasExactNameDuplicate(input.proposedSnapshot)) {
      return "duplicate";
    }

    const request = await models.ChangeRequest.create({
      userId: input.userId,
      requestType: "create",
      characterId: null,
      proposedSnapshot: input.proposedSnapshot as unknown as JsonObject,
      searchContext: input.searchContext as unknown as JsonObject,
      status: "pending",
      reviewerId: null,
      moderatorComment: null,
      resolvedAt: null
    });

    const summary = await reloadRequest(request.id);

    if (!summary) {
      throw new Error(`Change request ${request.id} could not be reloaded after creation.`);
    }

    return summary;
  }

  async listUserChangeRequests(userId: string): Promise<ChangeRequestSummary[]> {
    const requests = await models.ChangeRequest.findAll({
      where: { userId },
      include: requestInclude,
      order: [["createdAt", "DESC"]]
    });

    return serializeChangeRequests(requests);
  }

  async listModerationChangeRequests(
    status?: ChangeRequestSummary["status"]
  ): Promise<ChangeRequestSummary[]> {
    const requests = await models.ChangeRequest.findAll({
      where: status ? { status } : undefined,
      include: requestInclude,
      order: [["createdAt", "DESC"]]
    });

    return serializeChangeRequests(requests);
  }

  async getModerationChangeRequest(id: string): Promise<ChangeRequestSummary | null> {
    return reloadRequest(id);
  }

  async approveChangeRequest(input: {
    id: string;
    moderatorId: string;
  }): Promise<{ request: ChangeRequestSummary; changes: ChangeDiff } | null> {
    return sequelize.transaction(async (transaction) => {
      const request = await models.ChangeRequest.findByPk(input.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (request?.status !== "pending") {
        return null;
      }

      const proposedSnapshot = await prepareSnapshotForWrite(
        characterSnapshotSchema.parse(request.proposedSnapshot)
      );
      const changes =
        request.requestType === "create" ? calculateCharacterCreationDiff(proposedSnapshot) : null;

      let character: Character | null = null;

      if (request.requestType === "create") {
        character = await models.Character.create(
          {
            firstName: proposedSnapshot.firstName,
            lastName: proposedSnapshot.lastName,
            nickname: proposedSnapshot.nickname,
            birthDate: proposedSnapshot.birthDate,
            lifeStatus: proposedSnapshot.lifeStatus,
            deathOrDepartureDate: proposedSnapshot.deathOrDepartureDate,
            photoUrl: proposedSnapshot.photoUrl,
            businessName: proposedSnapshot.businessName,
            businessRank: proposedSnapshot.businessRank,
            businessBadgeNumber: proposedSnapshot.businessBadgeNumber,
            phoneNumber: proposedSnapshot.phoneNumber,
            streamerId: null,
            socialLinks: proposedSnapshot.socialLinks,
            groupName: proposedSnapshot.groupName,
            groupRole: proposedSnapshot.groupRole,
            district: proposedSnapshot.district,
            isRpDeath: proposedSnapshot.isRpDeath,
            policeRank: proposedSnapshot.policeRank,
            policeBadgeNumber: proposedSnapshot.policeBadgeNumber,
            previousCharacters: proposedSnapshot.previousCharacters,
            verificationStatus: proposedSnapshot.verificationStatus,
            sourceNote: proposedSnapshot.sourceNote,
            dataSource: "contribution"
          },
          { transaction }
        );
        await applySnapshot(character, proposedSnapshot, "contribution", transaction);
      } else if (request.characterId) {
        character = await models.Character.findByPk(request.characterId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!character) {
          return null;
        }
      }

      if (!character) {
        return null;
      }

      const resolvedChanges =
        changes ??
        calculateCharacterDiff(await characterToSnapshot(character, transaction), proposedSnapshot);

      if (request.requestType === "update") {
        await applySnapshot(character, proposedSnapshot, "contribution", transaction);
      }
      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: request.id,
          moderatorId: input.moderatorId,
          changes: resolvedChanges
        },
        { transaction }
      );
      await request.update(
        {
          status: "approved",
          characterId: character.id,
          proposedSnapshot: proposedSnapshot as unknown as JsonObject,
          reviewerId: input.moderatorId,
          resolvedAt: new Date()
        },
        { transaction }
      );

      const summary = await reloadRequest(request.id, transaction);

      if (!summary) {
        throw new Error(`Change request ${request.id} could not be reloaded after approval.`);
      }

      return { request: summary, changes: resolvedChanges };
    });
  }

  async rejectChangeRequest(input: {
    id: string;
    moderatorId: string;
    comment: string;
  }): Promise<ChangeRequestSummary | null> {
    const request = await models.ChangeRequest.findOne({
      where: { id: input.id, status: "pending" }
    });

    if (!request) {
      return null;
    }

    const proposedSnapshot = characterSnapshotSchema.safeParse(request.proposedSnapshot);

    if (proposedSnapshot.success) {
      await deletePendingCharacterPhoto(proposedSnapshot.data.photoUrl);
    }

    await request.update({
      status: "rejected",
      reviewerId: input.moderatorId,
      moderatorComment: input.comment,
      resolvedAt: new Date()
    });

    return reloadRequest(request.id);
  }

  async editCharacterDirectly(input: {
    characterId: string;
    moderatorId: string;
    snapshot: CharacterSnapshot;
  }): Promise<{ characterId: string; changes: ChangeDiff } | null> {
    return sequelize.transaction(async (transaction) => {
      const character = await models.Character.findByPk(input.characterId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!character) {
        return null;
      }

      const photoUrl = input.snapshot.photoUrl;

      if (isPendingCharacterPhotoToken(photoUrl)) {
        await assertPendingCharacterPhotoExists(photoUrl, input.moderatorId);
      }

      const currentSnapshot = await characterToSnapshot(character, transaction);
      const preparedSnapshot = await prepareSnapshotForWrite(input.snapshot);
      const changes = calculateCharacterDiff(currentSnapshot, preparedSnapshot);

      await applySnapshot(character, preparedSnapshot, "moderation", transaction);
      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: null,
          moderatorId: input.moderatorId,
          changes
        },
        { transaction }
      );

      return { characterId: character.id, changes };
    });
  }
}
