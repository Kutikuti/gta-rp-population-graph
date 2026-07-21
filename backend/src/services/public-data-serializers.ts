import type {
  DataSource,
  LifeStatus,
  RelationshipDirection,
  RelationshipType,
  TagType,
  VerificationStatus
} from "../db/enums.js";
import type {
  Character,
  CharacterRelationship,
  JsonObject,
  SocialLinks,
  Streamer,
  Tag
} from "../db/models/index.js";
import {
  relationshipGraphVisible,
  relationshipLabel,
  relationshipTypeForCharacterView
} from "./character-relationships.js";
import type { TwitchLiveStatus } from "./twitch-live.js";

export type PublicStreamer = {
  id: string;
  publicName: string;
  primaryPlatform: string | null;
  socialLinks: SocialLinks | null;
  twitchLiveStatus: TwitchLiveStatus;
  verificationStatus: VerificationStatus;
};

export type PublicTag = {
  id: string;
  name: string;
  type: TagType | null;
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
  phoneNumbers: string[];
  companyName: string | null;
  companyBadgeNumber: string | null;
  groupName: string | null;
  district: string | null;
  verificationStatus: VerificationStatus;
  dataSource: DataSource;
  streamer: PublicStreamer | null;
  tags: PublicTag[];
  updatedAt: string;
};

type PublicRelationship = {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: RelationshipType;
  graphVisible: boolean;
  direction: RelationshipDirection;
  label: string;
  description: string | null;
  source: DataSource;
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
  companyRank: string | null;
  twitchLiveStatus: TwitchLiveStatus;
  isRpDeath: boolean;
  previousCharacters: JsonObject | null;
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

type CytoscapeNode = {
  data: {
    id: string;
    type: "character";
    label: string;
    characterId: string;
    fullName: string;
    companyName: string | null;
    groupName: string | null;
    lifeStatus: LifeStatus;
    verificationStatus: VerificationStatus;
    photoUrl: string | null;
    streamerName: string | null;
    tagIds: string[];
  };
};

type CytoscapeEdge = {
  data: {
    id: string;
    type: "relationship";
    source: string;
    target: string;
    label: string;
    relationshipType: RelationshipType;
    direction: RelationshipDirection;
    verificationStatus: VerificationStatus;
  };
};

export type PublicGraph = {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
};

export type PublicHistoryEntry = {
  id: string;
  characterId: string;
  characterName: string | null;
  changes: JsonObject;
  createdAt: string;
};

export const fullName = (character: Pick<Character, "firstName" | "lastName">) =>
  `${character.firstName} ${character.lastName}`;

export const isoDate = (value: Date) => value.toISOString();

export const serializeStreamer = (
  streamer: Streamer | null | undefined,
  twitchLiveStatus: TwitchLiveStatus = "unknown"
): PublicStreamer | null => {
  if (!streamer) {
    return null;
  }

  return {
    id: streamer.id,
    publicName: streamer.publicName,
    primaryPlatform: streamer.primaryPlatform,
    socialLinks: streamer.socialLinks,
    twitchLiveStatus,
    verificationStatus: streamer.verificationStatus
  };
};

export const serializeTag = (tag: Tag): PublicTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description
});

export const serializeCharacterSummary = (
  character: Character,
  twitchLiveStatus: TwitchLiveStatus = "unknown"
): PublicCharacterSummary => ({
  id: character.id,
  publicSlug: character.publicSlug,
  firstName: character.firstName,
  lastName: character.lastName,
  fullName: fullName(character),
  nickname: character.nickname,
  photoUrl: character.photoUrl,
  lifeStatus: character.lifeStatus,
  phoneNumbers: character.phoneNumbers ?? [],
  companyName: character.companyName,
  companyBadgeNumber: character.companyBadgeNumber,
  groupName: character.groupName,
  district: character.district,
  verificationStatus: character.verificationStatus,
  dataSource: character.dataSource,
  streamer: serializeStreamer(character.streamer, twitchLiveStatus),
  tags: character.tags?.map(serializeTag) ?? [],
  updatedAt: isoDate(character.updatedAt)
});

const serializeRelationship = (
  relationship: CharacterRelationship,
  relatedCharacter: Character | undefined,
  currentCharacterId: string
): PublicRelationship => {
  if (!relatedCharacter) {
    throw new Error(`Relationship ${relationship.id} is missing its related character.`);
  }

  const type = relationshipTypeForCharacterView(
    relationship.type,
    relationship.direction,
    relationship.sourceCharacterId,
    currentCharacterId
  );

  return {
    id: relationship.id,
    sourceCharacterId: relationship.sourceCharacterId,
    targetCharacterId: relationship.targetCharacterId,
    type,
    graphVisible: relationshipGraphVisible(type),
    direction: relationship.direction,
    label: relationshipLabel(type),
    description: relationship.description,
    source: relationship.source,
    verificationStatus: relationship.verificationStatus,
    relatedCharacter: {
      id: relatedCharacter.id,
      firstName: relatedCharacter.firstName,
      lastName: relatedCharacter.lastName,
      fullName: fullName(relatedCharacter)
    }
  };
};

export const serializeCharacterDetail = (
  character: Character,
  twitchLiveStatus: TwitchLiveStatus = "unknown"
): PublicCharacterDetail => {
  const relationshipViewKey = (relationship: PublicRelationship) =>
    `${relationship.type}:${relationship.relatedCharacter.id}`;

  const dedupeRelationshipList = (relationships: PublicRelationship[]) => {
    const seen = new Set<string>();

    return relationships.filter((relationship) => {
      const key = relationshipViewKey(relationship);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  };

  const outgoing = dedupeRelationshipList(
    character.outgoingRelationships?.map((relationship) =>
      serializeRelationship(relationship, relationship.targetCharacter, character.id)
    ) ?? []
  );
  const outgoingKeys = new Set(outgoing.map(relationshipViewKey));
  const incoming = dedupeRelationshipList(
    character.incomingRelationships?.map((relationship) =>
      serializeRelationship(relationship, relationship.sourceCharacter, character.id)
    ) ?? []
  ).filter((relationship) => !outgoingKeys.has(relationshipViewKey(relationship)));

  return {
    ...serializeCharacterSummary(character, twitchLiveStatus),
    birthDate: character.birthDate,
    deathOrDepartureDate: character.deathOrDepartureDate,
    photoUrl: character.photoUrl,
    companyRank: character.companyRank,
    twitchLiveStatus,
    isRpDeath: character.isRpDeath,
    previousCharacters: character.previousCharacters,
    sourceNote: character.sourceNote,
    relationships: {
      outgoing,
      incoming
    },
    createdAt: isoDate(character.createdAt)
  };
};
