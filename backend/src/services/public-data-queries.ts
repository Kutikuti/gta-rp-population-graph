import { cast, col, type Includeable, Op, type Order, type WhereOptions, where } from "sequelize";

import type { LifeStatus, VerificationStatus } from "../db/enums.js";
import { Character, CharacterRelationship, Streamer, Tag } from "../db/models/index.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => uuidPattern.test(value);

const textOrUuidWhere = (value: string, textColumn: "name" | "publicName"): WhereOptions => {
  const conditions: WhereOptions[] = [{ [textColumn]: { [Op.iLike]: `%${value}%` } }];

  if (isUuid(value)) {
    conditions.unshift({ id: value });
  }

  return { [Op.or]: conditions };
};

type PublicCharacterQueryFilters = {
  q?: string;
  company?: string;
  lifeStatus?: LifeStatus;
  tag?: string;
  streamer?: string;
  verificationStatus?: VerificationStatus;
};

export const characterIncludes = (
  filters?: Pick<PublicCharacterQueryFilters, "tag" | "streamer">
): Includeable[] => [
  {
    model: Streamer,
    as: "streamer",
    required: Boolean(filters?.streamer),
    ...(filters?.streamer ? { where: textOrUuidWhere(filters.streamer, "publicName") } : {})
  },
  {
    model: Tag,
    as: "tags",
    through: { attributes: [] },
    required: Boolean(filters?.tag),
    ...(filters?.tag ? { where: textOrUuidWhere(filters.tag, "name") } : {})
  }
];

export const characterDetailIncludes = (): Includeable[] => [
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

export const characterWhere = (
  filters: Pick<PublicCharacterQueryFilters, "company" | "lifeStatus" | "q" | "verificationStatus">
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

export const historyWhere = (characterId?: string): WhereOptions =>
  characterId ? { characterId } : {};

export const characterOrder: Order = [
  ["lastName", "ASC"],
  ["firstName", "ASC"]
];
