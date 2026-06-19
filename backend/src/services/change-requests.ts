import type { Transaction } from "sequelize";
import { z } from "zod";

import { type DataSource, lifeStatuses, verificationStatuses } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import type { ChangeRequest, Character, JsonObject, SocialLinks } from "../db/models/index.js";

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
    socialLinks: socialLinksSchema,
    groupName: nullableText(160),
    groupRole: nullableText(120),
    district: nullableText(120),
    isRpDeath: z.boolean().default(false),
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

type ChangeValue = string | boolean | JsonObject | SocialLinks | null;

export type FieldChange = {
  old: ChangeValue;
  new: ChangeValue;
};

export type ChangeDiff = Record<string, FieldChange>;

export type ChangeRequestSummary = {
  id: string;
  characterId: string;
  characterName: string | null;
  userId: string;
  userDisplayName: string | null;
  status: "pending" | "approved" | "rejected";
  proposedSnapshot: JsonObject;
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

const characterToSnapshot = (character: Character): CharacterSnapshot => ({
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
  socialLinks: character.socialLinks,
  groupName: character.groupName,
  groupRole: character.groupRole,
  district: character.district,
  isRpDeath: character.isRpDeath,
  policeRank: character.policeRank,
  policeBadgeNumber: character.policeBadgeNumber,
  previousCharacters: character.previousCharacters as Record<string, string> | null,
  verificationStatus: character.verificationStatus,
  sourceNote: character.sourceNote
});

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

const serializeChangeRequest = (request: ChangeRequest): ChangeRequestSummary => ({
  id: request.id,
  characterId: request.characterId,
  characterName: request.character
    ? `${request.character.firstName} ${request.character.lastName}`
    : null,
  userId: request.userId,
  userDisplayName: request.user?.displayName ?? null,
  status: request.status,
  proposedSnapshot: request.proposedSnapshot,
  reviewerId: request.reviewerId,
  reviewerDisplayName: request.reviewer?.displayName ?? null,
  moderatorComment: request.moderatorComment,
  resolvedAt: isoDate(request.resolvedAt),
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString()
});

const requestInclude = [
  { association: "character", attributes: ["id", "firstName", "lastName"] },
  { association: "user", attributes: ["id", "displayName"] },
  { association: "reviewer", attributes: ["id", "displayName"], required: false }
];

const reloadRequest = async (id: string, transaction?: Transaction) => {
  const request = await models.ChangeRequest.findByPk(id, {
    include: requestInclude,
    transaction
  });

  return request ? serializeChangeRequest(request) : null;
};

const applySnapshot = async (
  character: Character,
  snapshot: CharacterSnapshot,
  source: DataSource,
  transaction: Transaction
) => {
  await character.update(
    {
      ...snapshot,
      dataSource: source
    },
    { transaction }
  );
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

    const request = await models.ChangeRequest.create({
      userId: input.userId,
      characterId: input.characterId,
      proposedSnapshot: input.proposedSnapshot as unknown as JsonObject,
      status: "pending",
      reviewerId: null,
      moderatorComment: null,
      resolvedAt: null
    });

    return reloadRequest(request.id);
  }

  async listUserChangeRequests(userId: string): Promise<ChangeRequestSummary[]> {
    const requests = await models.ChangeRequest.findAll({
      where: { userId },
      include: requestInclude,
      order: [["createdAt", "DESC"]]
    });

    return requests.map(serializeChangeRequest);
  }

  async listModerationChangeRequests(
    status?: ChangeRequestSummary["status"]
  ): Promise<ChangeRequestSummary[]> {
    const requests = await models.ChangeRequest.findAll({
      where: status ? { status } : undefined,
      include: requestInclude,
      order: [["createdAt", "DESC"]]
    });

    return requests.map(serializeChangeRequest);
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

      const character = await models.Character.findByPk(request.characterId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!character) {
        return null;
      }

      const proposedSnapshot = characterSnapshotSchema.parse(request.proposedSnapshot);
      const changes = calculateCharacterDiff(characterToSnapshot(character), proposedSnapshot);

      await applySnapshot(character, proposedSnapshot, "contribution", transaction);
      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: request.id,
          moderatorId: input.moderatorId,
          changes
        },
        { transaction }
      );
      await request.update(
        {
          status: "approved",
          reviewerId: input.moderatorId,
          resolvedAt: new Date()
        },
        { transaction }
      );

      const summary = await reloadRequest(request.id, transaction);

      if (!summary) {
        throw new Error(`Change request ${request.id} could not be reloaded after approval.`);
      }

      return { request: summary, changes };
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

      const changes = calculateCharacterDiff(characterToSnapshot(character), input.snapshot);

      await applySnapshot(character, input.snapshot, "moderation", transaction);
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
