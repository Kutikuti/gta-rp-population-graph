import { models, sequelize } from "../db/index.js";
import type { JsonObject } from "../db/models/index.js";
import {
  applyDirectCharacterEdit,
  approvePendingChangeRequest
} from "./change-request-mutations.js";
import {
  type CharacterCreationContext,
  type CharacterSnapshot,
  characterSnapshotSchema
} from "./change-request-schemas.js";
import type { ChangeDiff } from "./change-request-snapshots.js";
import {
  type ChangeRequestSummary,
  hasExactNameDuplicate,
  reloadChangeRequestSummary,
  requestInclude,
  serializeChangeRequests
} from "./change-request-summaries.js";
import {
  assertPendingCharacterPhotoExists,
  deletePendingCharacterPhoto,
  InvalidCharacterPhotoError,
  isPendingCharacterPhotoToken
} from "./character-photos.js";

export type { CharacterCreationContext, CharacterSnapshot } from "./change-request-schemas.js";
export {
  changeRequestCreateSchema,
  characterCreationRequestSchema,
  directCharacterEditSchema,
  moderationListSchema,
  rejectChangeRequestSchema
} from "./change-request-schemas.js";
export type { ChangeDiff } from "./change-request-snapshots.js";
export type { ChangeRequestSummary } from "./change-request-summaries.js";

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

    return reloadChangeRequestSummary(request.id);
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

    const summary = await reloadChangeRequestSummary(request.id);

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
    return reloadChangeRequestSummary(id);
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

      const proposedSnapshot = characterSnapshotSchema.parse(request.proposedSnapshot);

      const approval = await approvePendingChangeRequest({
        moderatorId: input.moderatorId,
        proposedSnapshot,
        request,
        transaction
      });

      if (!approval) {
        return null;
      }

      const summary = await reloadChangeRequestSummary(request.id, transaction);

      if (!summary) {
        throw new Error(`Change request ${request.id} could not be reloaded after approval.`);
      }

      return { request: summary, changes: approval.changes };
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

    return reloadChangeRequestSummary(request.id);
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

      return applyDirectCharacterEdit({
        character,
        moderatorId: input.moderatorId,
        snapshot: input.snapshot,
        transaction
      });
    });
  }
}
