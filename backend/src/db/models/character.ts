import {
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute
} from "sequelize";

import type {
  DataSource,
  LifeStatus,
  RelationshipDirection,
  RelationshipType,
  TagType,
  VerificationStatus
} from "../enums.js";
import type { JsonObject, SocialLinks } from "./shared.js";

export class Streamer extends Model<InferAttributes<Streamer>, InferCreationAttributes<Streamer>> {
  declare id: CreationOptional<string>;
  declare publicName: string;
  declare primaryPlatform: string | null;
  declare socialLinks: SocialLinks | null;
  declare verificationStatus: VerificationStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Character extends Model<
  InferAttributes<Character>,
  InferCreationAttributes<Character>
> {
  declare id: CreationOptional<string>;
  declare publicSlug: string;
  declare firstName: string;
  declare lastName: string;
  declare nickname: string | null;
  declare birthDate: string | null;
  declare lifeStatus: LifeStatus;
  declare deathOrDepartureDate: string | null;
  declare photoUrl: string | null;
  declare companyName: string | null;
  declare companyRank: string | null;
  declare companyBadgeNumber: string | null;
  declare phoneNumbers: string[] | null;
  declare streamerId: ForeignKey<Streamer["id"]> | null;
  declare groupName: string | null;
  declare district: string | null;
  declare isRpDeath: boolean;
  declare previousCharacters: JsonObject | null;
  declare verificationStatus: VerificationStatus;
  declare dataSource: DataSource;
  declare sourceNote: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare streamer?: NonAttribute<Streamer | null>;
  declare tags?: NonAttribute<Tag[]>;
  declare outgoingRelationships?: NonAttribute<CharacterRelationship[]>;
  declare incomingRelationships?: NonAttribute<CharacterRelationship[]>;
}

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare type: TagType | null;
  declare colorHex: string;
  declare description: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class CharacterTag extends Model<
  InferAttributes<CharacterTag>,
  InferCreationAttributes<CharacterTag>
> {
  declare characterId: ForeignKey<Character["id"]>;
  declare tagId: ForeignKey<Tag["id"]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class CharacterRelationship extends Model<
  InferAttributes<CharacterRelationship>,
  InferCreationAttributes<CharacterRelationship>
> {
  declare id: CreationOptional<string>;
  declare sourceCharacterId: ForeignKey<Character["id"]>;
  declare targetCharacterId: ForeignKey<Character["id"]>;
  declare type: RelationshipType;
  declare direction: RelationshipDirection;
  declare label: string;
  declare description: string | null;
  declare source: DataSource;
  declare verificationStatus: VerificationStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare sourceCharacter?: NonAttribute<Character>;
  declare targetCharacter?: NonAttribute<Character>;
}
