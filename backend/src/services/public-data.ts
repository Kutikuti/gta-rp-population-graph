import { Op, type Includeable, type WhereOptions } from "sequelize";

import { models } from "../db/index.js";
import {
  Character,
  CharacterRelationship,
  Streamer,
  Tag,
  type JsonObject,
  type SocialLinks
} from "../db/models/index.js";
import type {
  DataSource,
  LifeStatus,
  RelationshipDirection,
  RelationshipType,
  TagType,
  VerificationStatus
} from "../db/enums.js";

export type Pagination = {
  limit: number;
  offset: number;
};

export type CharacterListFilters = Pagination & {
  q?: string;
  lifeStatus?: LifeStatus;
  tag?: string;
  streamer?: string;
  verificationStatus?: VerificationStatus;
};

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
  type: TagType | null;
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
  businessRank: string | null;
  socialLinks: SocialLinks | null;
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

export type CytoscapeNode = {
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
  getCharacter(id: string): Promise<PublicCharacterDetail | null>;
  listTags(): Promise<PublicTag[]>;
  getGraph(): Promise<PublicGraph>;
  listHistory(pagination: Pagination): Promise<PublicHistoryEntry[]>;
};

const fullName = (character: Pick<Character, "firstName" | "lastName">) =>
  `${character.firstName} ${character.lastName}`;

const isoDate = (value: Date) => value.toISOString();

const serializeStreamer = (streamer: Streamer | null | undefined): PublicStreamer | null => {
  if (!streamer) {
    return null;
  }

  return {
    id: streamer.id,
    publicName: streamer.publicName,
    primaryPlatform: streamer.primaryPlatform,
    socialLinks: streamer.socialLinks,
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

const serializeCharacterSummary = (character: Character): PublicCharacterSummary => ({
  id: character.id,
  firstName: character.firstName,
  lastName: character.lastName,
  fullName: fullName(character),
  nickname: character.nickname,
  lifeStatus: character.lifeStatus,
  phoneNumber: character.phoneNumber,
  businessName: character.businessName,
  businessBadgeNumber: character.businessBadgeNumber,
  policeRank: character.policeRank,
  policeBadgeNumber: character.policeBadgeNumber,
  groupName: character.groupName,
  groupRole: character.groupRole,
  district: character.district,
  verificationStatus: character.verificationStatus,
  dataSource: character.dataSource,
  streamer: serializeStreamer(character.streamer),
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

const serializeCharacterDetail = (character: Character): PublicCharacterDetail => ({
  ...serializeCharacterSummary(character),
  birthDate: character.birthDate,
  deathOrDepartureDate: character.deathOrDepartureDate,
  photoUrl: character.photoUrl,
  businessRank: character.businessRank,
  socialLinks: character.socialLinks,
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

const characterIncludes = (filters?: Pick<CharacterListFilters, "tag" | "streamer">): Includeable[] => [
  {
    model: Streamer,
    as: "streamer",
    required: Boolean(filters?.streamer),
    where: filters?.streamer
      ? {
          [Op.or]: [
            { id: filters.streamer },
            { publicName: { [Op.iLike]: `%${filters.streamer}%` } }
          ]
        }
      : undefined
  },
  {
    model: Tag,
    as: "tags",
    through: { attributes: [] },
    required: Boolean(filters?.tag),
    where: filters?.tag
      ? {
          [Op.or]: [{ id: filters.tag }, { name: { [Op.iLike]: `%${filters.tag}%` } }]
        }
      : undefined
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
      { businessName: { [Op.iLike]: like } },
      { businessBadgeNumber: { [Op.iLike]: like } },
      { groupName: { [Op.iLike]: like } },
      { groupRole: { [Op.iLike]: like } },
      { district: { [Op.iLike]: like } },
      { policeRank: { [Op.iLike]: like } },
      { policeBadgeNumber: { [Op.iLike]: like } }
    ]
  };
};

export class SequelizePublicDataService implements PublicDataService {
  async listCharacters(filters: CharacterListFilters): Promise<PublicCharacterList> {
    const where: WhereOptions = {};

    if (filters.q) {
      Object.assign(where, searchWhere(filters.q));
    }

    if (filters.lifeStatus) {
      Object.assign(where, { lifeStatus: filters.lifeStatus });
    }

    if (filters.verificationStatus) {
      Object.assign(where, { verificationStatus: filters.verificationStatus });
    }

    const result = await models.Character.findAndCountAll({
      where,
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
      items: result.rows.map(serializeCharacterSummary),
      total: result.count,
      limit: filters.limit,
      offset: filters.offset
    };
  }

  async getCharacter(id: string): Promise<PublicCharacterDetail | null> {
    const character = await models.Character.findByPk(id, {
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

    return character ? serializeCharacterDetail(character) : null;
  }

  async listTags(): Promise<PublicTag[]> {
    const tags = await models.Tag.findAll({ order: [["name", "ASC"]] });
    return tags.map(serializeTag);
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
      models.CharacterRelationship.findAll({ order: [["label", "ASC"]] })
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

  async listHistory(pagination: Pagination): Promise<PublicHistoryEntry[]> {
    const entries = await models.ChangeHistory.findAll({
      include: [{ model: Character, as: "character" }],
      limit: pagination.limit,
      offset: pagination.offset,
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
