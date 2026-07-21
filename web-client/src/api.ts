import {
  buildApiError,
  buildApiUrl,
  deleteJson,
  fetchFreshJson,
  fetchJson,
  sendJson
} from "./api-client";
import type {
  AdminDashboard,
  AdminNotionImportBatch,
  AdminNotionImportDetail,
  AdminTag,
  AdminTagInput,
  AdminUser,
  AdminUserAnonymizationResult,
  AdminUserIdentityUnlinkResult,
  AdminUserPersonalDataExport,
  AdminUserSessionRevocationResult,
  ApplyAdminNotionImportEntryResult,
  AuthenticatedUser,
  AuthSession,
  ChangeDiff,
  ChangeRequestStatus,
  ChangeRequestSummary,
  CharacterCreationContext,
  CharacterFilters,
  CharacterSnapshot,
  DataCompletenessReport,
  ImportAdminNotionEntryPhotoResult,
  PersonalDataExport,
  PublicCharacterDetail,
  PublicCharacterMatches,
  PublicCharacterReference,
  PublicGraph,
  PublicHistoryEntry,
  PublicRelationship,
  PublicStreamer,
  PublicTag,
  RoleName
} from "./api-types";

export { ApiRequestError, resolveApiAssetUrl } from "./api-client";

export type {
  AdminDashboard,
  AdminNotionImportBatch,
  AdminNotionImportDetail,
  AdminNotionImportEntry,
  AdminTag,
  AdminTagInput,
  AdminUser,
  AdminUserAnonymizationResult,
  AdminUserIdentityUnlinkResult,
  AdminUserPersonalDataExport,
  AdminUserSessionRevocationResult,
  ApplyAdminNotionImportEntryResult,
  AuthenticatedUser,
  AuthSession,
  ChangeDiff,
  ChangeRequestStatus,
  ChangeRequestSummary,
  CharacterCreationContext,
  CharacterFilters,
  CharacterSnapshot,
  DataCompletenessReport,
  ImportAdminNotionEntryPhotoResult,
  LifeStatus,
  PersonalDataExport,
  PublicCharacterDetail,
  PublicCharacterMatches,
  PublicCharacterReference,
  PublicGraph,
  PublicHistoryEntry,
  PublicRelationship,
  PublicStreamer,
  PublicTag,
  RoleName,
  VerificationStatus
} from "./api-types";

const normalizeSnapshotRelationships = (relationships: CharacterSnapshot["relationships"]) => {
  const seen = new Set<string>();

  return relationships.filter((relationship) => {
    const key = `${relationship.type}:${relationship.characterId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const snapshotRelationshipType = (
  relationship: PublicRelationship,
  currentCharacterId: string
): CharacterSnapshot["relationships"][number]["type"] => {
  if (
    relationship.direction === "directed" &&
    relationship.targetCharacterId === currentCharacterId &&
    relationship.type === "parent"
  ) {
    return "child";
  }

  if (
    relationship.direction === "directed" &&
    relationship.targetCharacterId === currentCharacterId &&
    relationship.type === "child"
  ) {
    return "parent";
  }

  return relationship.type as CharacterSnapshot["relationships"][number]["type"];
};

const appendParam = (params: URLSearchParams, key: string, value: string) => {
  if (value.trim()) {
    params.set(key, value.trim());
  }
};

const characterFilterParams = (filters: CharacterFilters) => {
  const params = new URLSearchParams();
  appendParam(params, "q", filters.q);
  appendParam(params, "company", filters.company);
  appendParam(params, "tag", filters.tag);
  appendParam(params, "streamer", filters.streamer);

  if (filters.lifeStatus) {
    params.set("lifeStatus", filters.lifeStatus);
  }

  if (filters.twitchLive) {
    params.set("twitchLive", filters.twitchLive);
  }

  if (filters.verificationStatus) {
    params.set("verificationStatus", filters.verificationStatus);
  }

  return params;
};

export const listCharacterDirectory = () =>
  fetchJson<PublicCharacterReference[]>("/api/characters/directory");

export const listCharacterMatches = (filters: CharacterFilters) => {
  const params = characterFilterParams(filters);

  return fetchFreshJson<PublicCharacterMatches>(`/api/characters/matches?${params.toString()}`);
};

export const getCharacter = (id: string) =>
  fetchFreshJson<PublicCharacterDetail>(`/api/characters/${id}`);

export const listTags = () => fetchFreshJson<PublicTag[]>("/api/tags");

export const listStreamers = () => fetchJson<PublicStreamer[]>("/api/streamers");

export const getGraph = () => fetchFreshJson<PublicGraph>("/api/graph");

export const listHistory = (characterId?: string) => {
  const params = new URLSearchParams({ limit: "20" });

  if (characterId) {
    params.set("characterId", characterId);
  }

  return fetchFreshJson<PublicHistoryEntry[]>(`/api/history?${params.toString()}`);
};

export const getAuthSession = () => fetchJson<AuthSession>("/api/auth/session");

export const getGoogleAuthUrl = () => buildApiUrl("/api/auth/google");
export const getGoogleLinkUrl = () => buildApiUrl("/api/auth/google/link");
export const getDiscordAuthUrl = () => buildApiUrl("/api/auth/discord");
export const getDiscordLinkUrl = () => buildApiUrl("/api/auth/discord/link");
export const getTwitchAuthUrl = () => buildApiUrl("/api/auth/twitch");
export const getTwitchLinkUrl = () => buildApiUrl("/api/auth/twitch/link");

export const updateProfileDisplayName = (displayName: string) =>
  sendJson<{ user: AuthenticatedUser }>("/api/profile/display-name", "PATCH", { displayName });

export const unlinkProfileIdentity = (provider: "google" | "discord" | "twitch") =>
  fetchJson<{ user: AuthenticatedUser }>(
    `/api/profile/identities/${encodeURIComponent(provider)}`,
    {
      method: "DELETE"
    }
  );

export const exportProfilePersonalData = () =>
  fetchJson<PersonalDataExport>("/api/profile/personal-data");

export const getAdminDashboard = () => fetchJson<AdminDashboard>("/api/admin/dashboard");

export const getAdminUserPersonalData = (id: string) =>
  fetchJson<AdminUserPersonalDataExport>(`/api/admin/users/${id}/personal-data`);

export const getAdminDataCompleteness = () =>
  fetchJson<DataCompletenessReport>("/api/admin/completeness");

export const listAdminNotionImports = () =>
  fetchJson<AdminNotionImportBatch[]>("/api/admin/notion-imports");

export const getAdminNotionImportDetail = (id: string) =>
  fetchJson<AdminNotionImportDetail>(`/api/admin/notion-imports/${id}`);

export const applyAdminNotionImportEntry = (batchId: string, pageId: string) =>
  sendJson<ApplyAdminNotionImportEntryResult>(
    `/api/admin/notion-imports/${batchId}/entries/${encodeURIComponent(pageId)}/apply`,
    "POST"
  );

export const importAdminNotionEntryPhoto = (batchId: string, pageId: string) =>
  sendJson<ImportAdminNotionEntryPhotoResult>(
    `/api/admin/notion-imports/${batchId}/entries/${encodeURIComponent(pageId)}/import-photo`,
    "POST"
  );

export const createAdminTag = (input: AdminTagInput) =>
  sendJson<AdminTag>("/api/admin/tags", "POST", input);

export const updateAdminTag = (id: string, input: AdminTagInput) =>
  sendJson<AdminTag>(`/api/admin/tags/${id}`, "PATCH", input);

export const deleteAdminTag = (id: string) => deleteJson<never>(`/api/admin/tags/${id}`);

export const updateAdminUserRole = (id: string, role: RoleName) =>
  sendJson<AdminUser>(`/api/admin/users/${id}/role`, "PATCH", { role });

export const banAdminUser = (id: string, reason: string) =>
  sendJson<AdminUser>(`/api/admin/users/${id}/ban`, "POST", { reason });

export const revokeAdminUserBan = (id: string) =>
  deleteJson<AdminUser>(`/api/admin/users/${id}/ban`);

export const revokeAdminUserSessions = (id: string) =>
  deleteJson<AdminUserSessionRevocationResult>(`/api/admin/users/${id}/sessions`);

export const unlinkAdminUserIdentity = (id: string, provider: "google" | "discord" | "twitch") =>
  deleteJson<AdminUserIdentityUnlinkResult>(
    `/api/admin/users/${id}/identities/${encodeURIComponent(provider)}`
  );

export const anonymizeAdminUserAccount = (id: string) =>
  deleteJson<AdminUserAnonymizationResult>(`/api/admin/users/${id}/personal-data`);

export const logout = async () => {
  const response = await fetch(buildApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }
};

export const characterToSnapshot = (character: PublicCharacterDetail): CharacterSnapshot => ({
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
  phoneNumbers: character.phoneNumbers,
  streamerId: character.streamer?.id ?? null,
  streamerName: null,
  socialLinks: character.streamer?.socialLinks ?? null,
  groupName: character.groupName,
  district: character.district,
  isRpDeath: character.isRpDeath,
  relationships: normalizeSnapshotRelationships(
    [...character.relationships.outgoing, ...character.relationships.incoming].map(
      (relationship) => ({
        characterId: relationship.relatedCharacter.id,
        type: snapshotRelationshipType(relationship, character.id)
      })
    )
  ),
  previousCharacters: character.previousCharacters,
  verificationStatus: character.verificationStatus,
  sourceNote: character.sourceNote
});

export const createChangeRequest = (characterId: string, proposedSnapshot: CharacterSnapshot) =>
  sendJson<ChangeRequestSummary>("/api/contributions/change-requests", "POST", {
    characterId,
    proposedSnapshot
  });

export const createCharacterCreationRequest = (
  proposedSnapshot: CharacterSnapshot,
  searchContext: CharacterCreationContext
) =>
  sendJson<ChangeRequestSummary>("/api/contributions/change-requests/character-creations", "POST", {
    proposedSnapshot,
    searchContext
  });

export const listMyChangeRequests = () =>
  fetchJson<ChangeRequestSummary[]>("/api/contributions/change-requests");

export const uploadCharacterPhotoDraft = async (characterId: string, image: Blob) => {
  const response = await fetch(
    buildApiUrl(`/api/contributions/characters/${characterId}/photo-drafts`),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": image.type || "image/webp"
      },
      body: image
    }
  );

  if (!response.ok) {
    throw new Error(`Erreur API ${String(response.status)}`);
  }

  return (await response.json()) as { photoUrl: string };
};

export const listModerationChangeRequests = (status: ChangeRequestStatus = "pending") => {
  const params = new URLSearchParams({ status });
  return fetchJson<ChangeRequestSummary[]>(`/api/moderation/change-requests?${params.toString()}`);
};

export const getModerationDataCompleteness = () =>
  fetchJson<DataCompletenessReport>("/api/moderation/completeness");

export const approveChangeRequest = (id: string) =>
  sendJson<{ request: ChangeRequestSummary; changes: ChangeDiff }>(
    `/api/moderation/change-requests/${id}/approve`,
    "POST"
  );

export const rejectChangeRequest = (id: string, comment: string) =>
  sendJson<ChangeRequestSummary>(`/api/moderation/change-requests/${id}/reject`, "POST", {
    comment
  });

export const editCharacterDirectly = (characterId: string, snapshot: CharacterSnapshot) =>
  sendJson<{ characterId: string; changes: ChangeDiff }>(
    `/api/moderation/characters/${characterId}`,
    "PATCH",
    { snapshot }
  );

export const createCharacterDirectly = (snapshot: CharacterSnapshot) =>
  sendJson<{ characterId: string; changes: ChangeDiff }>("/api/moderation/characters", "POST", {
    snapshot
  });
