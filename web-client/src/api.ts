export type LifeStatus = "alive" | "deceased" | "left" | "unknown";
export type VerificationStatus = "verified" | "community" | "imported" | "to_check" | "disputed";

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
  firstName: string;
  lastName: string;
  fullName: string;
  nickname: string | null;
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
  photoUrl: string | null;
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

export type CharacterFilters = {
  q: string;
  lifeStatus: "" | LifeStatus;
  tag: string;
  streamer: string;
  verificationStatus: "" | VerificationStatus;
};

const env = import.meta.env as { readonly VITE_API_BASE_URL?: string };
const API_BASE_URL = env.VITE_API_BASE_URL ?? "http://localhost:4000";

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Erreur API ${String(response.status)}`);
  }

  return (await response.json()) as T;
};

const appendParam = (params: URLSearchParams, key: string, value: string) => {
  if (value.trim()) {
    params.set(key, value.trim());
  }
};

export const listCharacters = (filters: CharacterFilters) => {
  const params = new URLSearchParams({ limit: "100" });
  appendParam(params, "q", filters.q);
  appendParam(params, "tag", filters.tag);
  appendParam(params, "streamer", filters.streamer);

  if (filters.lifeStatus) {
    params.set("lifeStatus", filters.lifeStatus);
  }

  if (filters.verificationStatus) {
    params.set("verificationStatus", filters.verificationStatus);
  }

  return fetchJson<PublicCharacterList>(`/api/characters?${params.toString()}`);
};

export const getCharacter = (id: string) =>
  fetchJson<PublicCharacterDetail>(`/api/characters/${id}`);

export const listTags = () => fetchJson<PublicTag[]>("/api/tags");

export const getGraph = () => fetchJson<PublicGraph>("/api/graph");

export const listHistory = (characterId?: string) => {
  const params = new URLSearchParams({ limit: "20" });

  if (characterId) {
    params.set("characterId", characterId);
  }

  return fetchJson<PublicHistoryEntry[]>(`/api/history?${params.toString()}`);
};
