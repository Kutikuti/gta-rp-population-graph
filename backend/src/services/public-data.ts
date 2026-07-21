import { cast, col, type Includeable, Op, type Order, type WhereOptions, where } from "sequelize";
import type { LifeStatus, VerificationStatus } from "../db/enums.js";
import { models } from "../db/index.js";
import { Character, CharacterRelationship, Streamer, Tag } from "../db/models/index.js";
import { SequelizePublicGraphService } from "./public-data-graph.js";
import {
  fullName,
  isoDate,
  type PublicCharacterDetail,
  type PublicCharacterList,
  type PublicCharacterMatches,
  type PublicCharacterReference,
  type PublicGraph,
  type PublicHistoryEntry,
  type PublicStreamer,
  type PublicTag,
  serializeCharacterDetail,
  serializeCharacterSummary,
  serializeStreamer,
  serializeTag
} from "./public-data-serializers.js";
import { type TwitchLiveStatus, TwitchLiveStatusService } from "./twitch-live.js";

export type {
  PublicCharacterDetail,
  PublicCharacterList,
  PublicCharacterMatches,
  PublicCharacterReference,
  PublicCharacterSummary,
  PublicGraph,
  PublicHistoryEntry,
  PublicStreamer,
  PublicTag
} from "./public-data-serializers.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => uuidPattern.test(value);

const textOrUuidWhere = (value: string, textColumn: "name" | "publicName"): WhereOptions => {
  const conditions: WhereOptions[] = [{ [textColumn]: { [Op.iLike]: `%${value}%` } }];

  if (isUuid(value)) {
    conditions.unshift({ id: value });
  }

  return { [Op.or]: conditions };
};

type Pagination = {
  limit: number;
  offset: number;
};

export type CharacterListFilters = Pagination & {
  q?: string;
  company?: string;
  lifeStatus?: LifeStatus;
  tag?: string;
  streamer?: string;
  twitchLive?: "live";
  verificationStatus?: VerificationStatus;
};

export type CharacterMatchFilters = Omit<CharacterListFilters, "limit" | "offset">;

export type HistoryFilters = Pagination & {
  characterId?: string;
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
      where(cast(col("Character.phone_numbers"), "text"), { [Op.iLike]: like }),
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

const applyPagination = <T>(items: T[], pagination: Pagination) =>
  items.slice(pagination.offset, pagination.offset + pagination.limit);

const characterOrder: Order = [
  ["lastName", "ASC"],
  ["firstName", "ASC"]
];

export class SequelizePublicDataService implements PublicDataService {
  readonly #graph = new SequelizePublicGraphService();

  constructor(
    private readonly twitchLiveStatusService: TwitchLiveStatusService = new TwitchLiveStatusService()
  ) {}

  private async loadTwitchStatuses(
    characters: Character[]
  ): Promise<Map<string, TwitchLiveStatus>> {
    const entries = await Promise.all(
      characters.map(
        async (character) =>
          [
            character.id,
            await this.twitchLiveStatusService.getStatusForSocialLinks(
              character.streamer?.socialLinks
            )
          ] as const
      )
    );

    return new Map(entries);
  }

  private async filterCharactersByTwitchLive(
    characters: Character[],
    twitchLive: CharacterListFilters["twitchLive"]
  ) {
    const statusesByCharacterId = await this.loadTwitchStatuses(characters);

    if (twitchLive !== "live") {
      return {
        characters,
        statusesByCharacterId
      };
    }

    return {
      characters: characters.filter(
        (character) => statusesByCharacterId.get(character.id) === "live"
      ),
      statusesByCharacterId
    };
  }

  async listCharacters(filters: CharacterListFilters): Promise<PublicCharacterList> {
    const baseQuery = {
      where: characterWhere(filters),
      include: characterIncludes(filters),
      order: characterOrder
    };

    if (filters.twitchLive === "live") {
      const characters = await models.Character.findAll(baseQuery);
      const { characters: filteredCharacters, statusesByCharacterId } =
        await this.filterCharactersByTwitchLive(characters, filters.twitchLive);
      const pagedCharacters = applyPagination(filteredCharacters, filters);

      return {
        items: pagedCharacters.map((character) =>
          serializeCharacterSummary(character, statusesByCharacterId.get(character.id) ?? "unknown")
        ),
        total: filteredCharacters.length,
        limit: filters.limit,
        offset: filters.offset
      };
    }

    const result = await models.Character.findAndCountAll({
      ...baseQuery,
      distinct: true,
      limit: filters.limit,
      offset: filters.offset
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
    const characters = await models.Character.findAll({
      where: characterWhere(filters),
      include: characterIncludes(filters),
      order: characterOrder
    });
    const { characters: filteredCharacters } = await this.filterCharactersByTwitchLive(
      characters,
      filters.twitchLive
    );

    return {
      ids: filteredCharacters.map((character) => character.id),
      total: filteredCharacters.length
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
      character.streamer?.socialLinks
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
    return this.#graph.getGraph();
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
