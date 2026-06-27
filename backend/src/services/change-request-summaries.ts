import { Op, type Transaction } from "sequelize";

import type { changeRequestTypes } from "../db/enums.js";
import { models } from "../db/index.js";
import type { ChangeRequest, JsonObject } from "../db/models/index.js";
import type { CharacterCreationContext, CharacterSnapshot } from "./change-request-schemas.js";

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

export const requestInclude = [
  { association: "character", attributes: ["id", "firstName", "lastName"], required: false },
  { association: "user", attributes: ["id", "displayName"] },
  { association: "reviewer", attributes: ["id", "displayName"], required: false }
];

const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

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

export const serializeChangeRequests = async (requests: ChangeRequest[]) => {
  const proposedStreamerNames = await buildProposedStreamerNameMap(requests);

  return requests.map((request) => serializeChangeRequest(request, proposedStreamerNames));
};

export const reloadChangeRequestSummary = async (id: string, transaction?: Transaction) => {
  const request = await models.ChangeRequest.findByPk(id, {
    include: requestInclude,
    transaction
  });

  if (!request) {
    return null;
  }

  const [summary] = await serializeChangeRequests([request]);

  return summary ?? null;
};

export const hasExactNameDuplicate = async (snapshot: CharacterSnapshot) => {
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

export type { CharacterCreationContext, CharacterSnapshot };
