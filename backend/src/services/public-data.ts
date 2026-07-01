import { type Includeable, Op, type WhereOptions } from "sequelize";
import type {
  DataSource,
  LifeStatus,
  RelationshipDirection,
  RelationshipType,
  TagType,
  VerificationStatus
} from "../db/enums.js";
import { graphRelationshipTypes } from "../db/enums.js";
import { models } from "../db/index.js";
import {
  Character,
  CharacterRelationship,
  type JsonObject,
  type SocialLinks,
  Streamer,
  Tag
} from "../db/models/index.js";
import { relationshipGraphVisible } from "./character-relationships.js";
import { type TwitchLiveStatus, TwitchLiveStatusService } from "./twitch-live.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => uuidPattern.test(value);

const textOrUuidWhere = (value: string, textColumn: "name" | "publicName"): WhereOptions => {
  const conditions: WhereOptions[] = [{ [textColumn]: { [Op.iLike]: `%${value}%` } }];

  if (isUuid(value)) {
    conditions.unshift({ id: value });
  }

  return { [Op.or]: conditions };
};

export type Pagination = {
  limit: number;
  offset: number;
};

export type CharacterListFilters = Pagination & {
  q?: string;
  company?: string;
  lifeStatus?: LifeStatus;
  tag?: string;
  streamer?: string;
  verificationStatus?: VerificationStatus;
};

export type CharacterMatchFilters = Omit<CharacterListFilters, "limit" | "offset">;

export type HistoryFilters = Pagination & {
  characterId?: string;
};

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
  phoneNumber: string | null;
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

export type PublicRelationship = {
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
  socialLinks: SocialLinks | null;
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

export type CytoscapeNode = {
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
};

export type CytoscapeEdge = {
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

export type PublicDataService = {
  listCharacters(filters: CharacterListFilters): Promise<PublicCharacterList>;
  listCharacterDirectory(): Promise<PublicCharacterReference[]>;
  listCharacterMatches(filters: CharacterMatchFilters): Promise<PublicCharacterMatches>;
  getCharacter(identifier: string): Promise<PublicCharacterDetail | null>;
  listStreamers(): Promise<PublicStreamer[]>;
  listTags(): Promise<PublicTag[]>;
  getGraph(): Promise<PublicGraph>;
  listHistory(filters: HistoryFilters): Promise<PublicHistoryEntry[]>;
};

const fullName = (character: Pick<Character, "firstName" | "lastName">) =>
  `${character.firstName} ${character.lastName}`;

const isoDate = (value: Date) => value.toISOString();

const serializeStreamer = (
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

const serializeTag = (tag: Tag): PublicTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description
});

const serializeCharacterSummary = (
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
  phoneNumber: character.phoneNumber,
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
  relatedCharacter: Character | undefined
): PublicRelationship => {
  if (!relatedCharacter) {
    throw new Error(`Relationship ${relationship.id} is missing its related character.`);
  }

  return {
    id: relationship.id,
    sourceCharacterId: relationship.sourceCharacterId,
    targetCharacterId: relationship.targetCharacterId,
    type: relationship.type,
    graphVisible: relationshipGraphVisible(relationship.type),
    direction: relationship.direction,
    label: relationship.label,
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

const serializeCharacterDetail = (
  character: Character,
  twitchLiveStatus: TwitchLiveStatus = "unknown"
): PublicCharacterDetail => ({
  ...serializeCharacterSummary(character, twitchLiveStatus),
  birthDate: character.birthDate,
  deathOrDepartureDate: character.deathOrDepartureDate,
  photoUrl: character.photoUrl,
  companyRank: character.companyRank,
  socialLinks: character.socialLinks,
  twitchLiveStatus,
  isRpDeath: character.isRpDeath,
  previousCharacters: character.previousCharacters,
  sourceNote: character.sourceNote,
  relationships: {
    outgoing:
      character.outgoingRelationships?.map((relationship) =>
        serializeRelationship(relationship, relationship.targetCharacter)
      ) ?? [],
    incoming:
      character.incomingRelationships?.map((relationship) =>
        serializeRelationship(relationship, relationship.sourceCharacter)
      ) ?? []
  },
  createdAt: isoDate(character.createdAt)
});

const characterIncludes = (
  filters?: Pick<CharacterListFilters, "tag" | "streamer">
): Includeable[] => [
  {
    model: Streamer,
    as: "streamer",
    required: Boolean(filters?.streamer),
    where: filters?.streamer ? textOrUuidWhere(filters.streamer, "publicName") : undefined
  },
  {
    model: Tag,
    as: "tags",
    through: { attributes: [] },
    required: Boolean(filters?.tag),
    where: filters?.tag ? textOrUuidWhere(filters.tag, "name") : undefined
  }
];

const searchWhere = (q: string): WhereOptions => {
  const like = `%${q}%`;

  return {
    [Op.or]: [
      { firstName: { [Op.iLike]: like } },
      { lastName: { [Op.iLike]: like } },
      { nickname: { [Op.iLike]: like } },
      { phoneNumber: { [Op.iLike]: like } },
      { companyName: { [Op.iLike]: like } },
      { companyRank: { [Op.iLike]: like } },
      { companyBadgeNumber: { [Op.iLike]: like } },
      { groupName: { [Op.iLike]: like } },
      { district: { [Op.iLike]: like } }
    ]
  };
};

const characterWhere = (
  filters: Pick<CharacterListFilters, "company" | "lifeStatus" | "q" | "verificationStatus">
): WhereOptions => {
  const where: WhereOptions = {};

  if (filters.q) {
    Object.assign(where, searchWhere(filters.q));
  }

  if (filters.lifeStatus) {
    Object.assign(where, { lifeStatus: filters.lifeStatus });
  }

  if (filters.company) {
    Object.assign(where, { companyName: { [Op.iLike]: `%${filters.company}%` } });
  }

  if (filters.verificationStatus) {
    Object.assign(where, { verificationStatus: filters.verificationStatus });
  }

  return where;
};

export class SequelizePublicDataService implements PublicDataService {
  constructor(
    private readonly twitchLiveStatusService: TwitchLiveStatusService = new TwitchLiveStatusService()
  ) {}

  async listCharacters(filters: CharacterListFilters): Promise<PublicCharacterList> {
    const result = await models.Character.findAndCountAll({
      where: characterWhere(filters),
      include: characterIncludes(filters),
      distinct: true,
      limit: filters.limit,
      offset: filters.offset,
      order: [
        ["lastName", "ASC"],
        ["firstName", "ASC"]
      ]
    });

    return {
      items: result.rows.map((character) => serializeCharacterSummary(character)),
      total: result.count,
      limit: filters.limit,
      offset: filters.offset
    };
  }

  async listCharacterDirectory(): Promise<PublicCharacterReference[]> {
    const characters = await models.Character.findAll({
      attributes: ["id", "publicSlug", "firstName", "lastName"],
      order: [
        ["lastName", "ASC"],
        ["firstName", "ASC"]
      ]
    });

    return characters.map((character) => ({
      id: character.id,
      publicSlug: character.publicSlug,
      fullName: fullName(character)
    }));
  }

  async listCharacterMatches(filters: CharacterMatchFilters): Promise<PublicCharacterMatches> {
    const result = await models.Character.findAndCountAll({
      attributes: ["id"],
      where: characterWhere(filters),
      include: characterIncludes(filters),
      distinct: true,
      order: [
        ["lastName", "ASC"],
        ["firstName", "ASC"]
      ]
    });

    return {
      ids: result.rows.map((character) => character.id),
      total: result.count
    };
  }

  async getCharacter(identifier: string): Promise<PublicCharacterDetail | null> {
    const character = await models.Character.findOne({
      where: isUuid(identifier) ? { id: identifier } : { publicSlug: identifier },
      include: [
        ...characterIncludes(),
        {
          model: CharacterRelationship,
          as: "outgoingRelationships",
          include: [{ model: Character, as: "targetCharacter" }]
        },
        {
          model: CharacterRelationship,
          as: "incomingRelationships",
          include: [{ model: Character, as: "sourceCharacter" }]
        }
      ]
    });

    if (!character) {
      return null;
    }

    const twitchLiveStatus = await this.twitchLiveStatusService.getStatusForSocialLinks(
      character.socialLinks ?? character.streamer?.socialLinks
    );

    return serializeCharacterDetail(character, twitchLiveStatus);
  }

  async listTags(): Promise<PublicTag[]> {
    const tags = await models.Tag.findAll({ order: [["name", "ASC"]] });
    return tags.map(serializeTag);
  }

  async listStreamers(): Promise<PublicStreamer[]> {
    const streamers = await models.Streamer.findAll({
      order: [["publicName", "ASC"]]
    });

    return streamers
      .map((streamer) => serializeStreamer(streamer))
      .filter((streamer) => streamer !== null);
  }

  async getGraph(): Promise<PublicGraph> {
    const [characters, relationships] = await Promise.all([
      models.Character.findAll({
        include: characterIncludes(),
        order: [
          ["lastName", "ASC"],
          ["firstName", "ASC"]
        ]
      }),
      models.CharacterRelationship.findAll({
        where: {
          type: {
            [Op.in]: graphRelationshipTypes
          }
        },
        order: [["label", "ASC"]]
      })
    ]);

    return {
      nodes: characters.map((character) => ({
        data: {
          id: character.id,
          type: "character",
          label: fullName(character),
          characterId: character.id,
          fullName: fullName(character),
          lifeStatus: character.lifeStatus,
          verificationStatus: character.verificationStatus,
          photoUrl: character.photoUrl,
          streamerName: character.streamer?.publicName ?? null,
          tagIds: character.tags?.map((tag) => tag.id) ?? []
        }
      })),
      edges: relationships.map((relationship) => ({
        data: {
          id: relationship.id,
          type: "relationship",
          source: relationship.sourceCharacterId,
          target: relationship.targetCharacterId,
          label: relationship.label,
          relationshipType: relationship.type,
          direction: relationship.direction,
          verificationStatus: relationship.verificationStatus
        }
      }))
    };
  }

  async listHistory(filters: HistoryFilters): Promise<PublicHistoryEntry[]> {
    const where: WhereOptions = {};

    if (filters.characterId) {
      Object.assign(where, { characterId: filters.characterId });
    }

    const entries = await models.ChangeHistory.findAll({
      where,
      include: [{ model: Character, as: "character" }],
      limit: filters.limit,
      offset: filters.offset,
      order: [["createdAt", "DESC"]]
    });

    return entries.map((entry) => ({
      id: entry.id,
      characterId: entry.characterId,
      characterName: entry.character ? fullName(entry.character) : null,
      changes: entry.changes,
      createdAt: isoDate(entry.createdAt)
    }));
  }
}
