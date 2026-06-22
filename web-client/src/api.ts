export type LifeStatus = "alive" | "deceased" | "left" | "unknown";
export type VerificationStatus = "verified" | "community" | "imported" | "to_check" | "disputed";
export type RoleName = "user" | "moderator" | "administrator";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";
export type ChangeRequestType = "update" | "create";

export type SocialLinks = Partial<
  Record<"twitch" | "kick" | "youtube" | "instagram" | "tiktok", string>
>;

export type PublicStreamer = {
  id: string;
  publicName: string;
  primaryPlatform: string | null;
  socialLinks: SocialLinks | null;
  verificationStatus: VerificationStatus;
};

export type PublicTag = {
  id: string;
  name: string;
  type: string | null;
  colorHex: string;
  description: string | null;
};

export type PublicCharacterSummary = {
  id: string;
  publicSlug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  lifeStatus: LifeStatus;
  phoneNumber: string | null;
  businessName: string | null;
  businessBadgeNumber: string | null;
  policeRank: string | null;
  policeBadgeNumber: string | null;
  groupName: string | null;
  groupRole: string | null;
  district: string | null;
  verificationStatus: VerificationStatus;
  dataSource: string;
  streamer: PublicStreamer | null;
  tags: PublicTag[];
  updatedAt: string;
};

export type PublicRelationship = {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: string;
  direction: string;
  label: string;
  description: string | null;
  source: string;
  verificationStatus: VerificationStatus;
  relatedCharacter: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
};

export type PublicCharacterDetail = PublicCharacterSummary & {
  birthDate: string | null;
  deathOrDepartureDate: string | null;
  businessRank: string | null;
  socialLinks: SocialLinks | null;
  isRpDeath: boolean;
  previousCharacters: Record<string, string> | null;
  sourceNote: string | null;
  relationships: {
    outgoing: PublicRelationship[];
    incoming: PublicRelationship[];
  };
  createdAt: string;
};

export type PublicCharacterList = {
  items: PublicCharacterSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type PublicCharacterReference = {
  id: string;
  publicSlug: string;
  fullName: string;
};

export type PublicCharacterMatches = {
  ids: string[];
  total: number;
};

export type PublicGraph = {
  nodes: Array<{
    data: {
      id: string;
      type: "character";
      label: string;
      characterId: string;
      fullName: string;
      lifeStatus: LifeStatus;
      verificationStatus: VerificationStatus;
      photoUrl: string | null;
      streamerName: string | null;
      tagIds: string[];
    };
  }>;
  edges: Array<{
    data: {
      id: string;
      type: "relationship";
      source: string;
      target: string;
      label: string;
      relationshipType: string;
      direction: string;
      verificationStatus: VerificationStatus;
    };
  }>;
};

export type PublicHistoryEntry = {
  id: string;
  characterId: string;
  characterName: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  mustChooseDisplayName: boolean;
  avatarUrl: string | null;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
};

export type AuthSession =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: AuthenticatedUser;
    };

export type CharacterFilters = {
  q: string;
  lifeStatus: "" | LifeStatus;
  tag: string;
  streamer: string;
  verificationStatus: "" | VerificationStatus;
};

export type CharacterSnapshot = {
  firstName: string;
  lastName: string;
  nickname: string | null;
  birthDate: string | null;
  lifeStatus: LifeStatus;
  deathOrDepartureDate: string | null;
  photoUrl: string | null;
  businessName: string | null;
  businessRank: string | null;
  businessBadgeNumber: string | null;
  phoneNumber: string | null;
  streamerId: string | null;
  streamerName: string | null;
  socialLinks: SocialLinks | null;
  groupName: string | null;
  groupRole: string | null;
  district: string | null;
  isRpDeath: boolean;
  relationships: Array<{
    characterId: string;
    type: "parent" | "child" | "sibling" | "couple";
  }>;
  policeRank: string | null;
  policeBadgeNumber: string | null;
  previousCharacters: Record<string, string> | null;
  verificationStatus: VerificationStatus;
  sourceNote: string | null;
};

export type FieldChange = {
  old: unknown;
  new: unknown;
};

export type ChangeDiff = Record<string, FieldChange>;

export type ChangeRequestSummary = {
  id: string;
  requestType: ChangeRequestType;
  characterId: string | null;
  characterName: string | null;
  proposedStreamerName: string | null;
  userId: string;
  userDisplayName: string | null;
  status: ChangeRequestStatus;
  proposedSnapshot: CharacterSnapshot;
  searchContext: CharacterCreationContext | null;
  reviewerId: string | null;
  reviewerDisplayName: string | null;
  moderatorComment: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CharacterCreationContext = CharacterFilters & {
  matchTotal: number;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminTag = {
  id: string;
  name: string;
  type: "family" | "district" | "organization" | "business" | "other" | null;
  colorHex: string;
  description: string | null;
  usageCount: number;
};

export type AdminActionEntry = {
  id: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  targetUser: {
    id: string;
    displayName: string;
  } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type AdminDashboard = {
  users: AdminUser[];
  tags: AdminTag[];
  actions: AdminActionEntry[];
};

export type AdminTagInput = {
  name: string;
  type: AdminTag["type"];
  colorHex: string;
  description: string | null;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

const env = import.meta.env as { readonly VITE_API_BASE_URL?: string };
const API_BASE_URL = env.VITE_API_BASE_URL ?? "http://localhost:4000";

const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

const buildApiError = async (response: Response) => {
  let message = `Erreur API ${String(response.status)}`;
  let code: string | null = null;

  try {
    const body = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    if (body.error?.message) {
      message = body.error.message;
    }

    if (body.error?.code) {
      code = body.error.code;
    }
  } catch {
    // Ignore invalid or empty error bodies and keep the fallback message.
  }

  return new ApiRequestError(message, response.status, code);
};

export const resolveApiAssetUrl = (path: string | null) => {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//u.test(path)) {
    return path;
  }

  return buildApiUrl(path);
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as T;
};

const sendJson = async <T>(path: string, method: "POST" | "PATCH", body?: unknown): Promise<T> =>
  fetchJson<T>(path, {
    method,
    body: body ? JSON.stringify(body) : undefined
  });

const deleteJson = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(buildApiUrl(path), {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
};

const appendParam = (params: URLSearchParams, key: string, value: string) => {
  if (value.trim()) {
    params.set(key, value.trim());
  }
};

const characterFilterParams = (filters: CharacterFilters) => {
  const params = new URLSearchParams();
  appendParam(params, "q", filters.q);
  appendParam(params, "tag", filters.tag);
  appendParam(params, "streamer", filters.streamer);

  if (filters.lifeStatus) {
    params.set("lifeStatus", filters.lifeStatus);
  }

  if (filters.verificationStatus) {
    params.set("verificationStatus", filters.verificationStatus);
  }

  return params;
};

export const listCharacters = (filters: CharacterFilters) => {
  const params = characterFilterParams(filters);
  params.set("limit", "100");

  return fetchJson<PublicCharacterList>(`/api/characters?${params.toString()}`);
};

export const listCharacterDirectory = () =>
  fetchJson<PublicCharacterReference[]>("/api/characters/directory");

export const listCharacterMatches = (filters: CharacterFilters) => {
  const params = characterFilterParams(filters);

  return fetchJson<PublicCharacterMatches>(`/api/characters/matches?${params.toString()}`);
};

export const getCharacter = (id: string) =>
  fetchJson<PublicCharacterDetail>(`/api/characters/${id}`);

export const listTags = () => fetchJson<PublicTag[]>("/api/tags");

export const listStreamers = () => fetchJson<PublicStreamer[]>("/api/streamers");

export const getGraph = () => fetchJson<PublicGraph>("/api/graph");

export const listHistory = (characterId?: string) => {
  const params = new URLSearchParams({ limit: "20" });

  if (characterId) {
    params.set("characterId", characterId);
  }

  return fetchJson<PublicHistoryEntry[]>(`/api/history?${params.toString()}`);
};

export const getAuthSession = () => fetchJson<AuthSession>("/api/auth/session");

export const getGoogleAuthUrl = () => buildApiUrl("/api/auth/google");

export const updateProfileDisplayName = (displayName: string) =>
  sendJson<{ user: AuthenticatedUser }>("/api/profile/display-name", "PATCH", { displayName });

export const getAdminDashboard = () => fetchJson<AdminDashboard>("/api/admin/dashboard");

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
  businessName: character.businessName,
  businessRank: character.businessRank,
  businessBadgeNumber: character.businessBadgeNumber,
  phoneNumber: character.phoneNumber,
  streamerId: character.streamer?.id ?? null,
  streamerName: null,
  socialLinks: character.socialLinks,
  groupName: character.groupName,
  groupRole: character.groupRole,
  district: character.district,
  isRpDeath: character.isRpDeath,
  relationships: [...character.relationships.outgoing, ...character.relationships.incoming].map(
    (relationship) => ({
      characterId: relationship.relatedCharacter.id,
      type:
        relationship.direction === "directed" &&
        relationship.targetCharacterId === character.id &&
        relationship.type === "parent"
          ? "child"
          : relationship.direction === "directed" &&
              relationship.targetCharacterId === character.id &&
              relationship.type === "child"
            ? "parent"
            : (relationship.type as "parent" | "child" | "sibling" | "couple")
    })
  ),
  policeRank: character.policeRank,
  policeBadgeNumber: character.policeBadgeNumber,
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
