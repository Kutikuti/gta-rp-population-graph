import {
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute
} from "sequelize";

import type { NotionImportBatchStatus, NotionImportEntryStatus } from "../enums.js";
import type { Character } from "./character.js";
import type { User } from "./identity.js";
import type { JsonObject } from "./shared.js";

export class NotionImportBatch extends Model<
  InferAttributes<NotionImportBatch>,
  InferCreationAttributes<NotionImportBatch>
> {
  declare id: CreationOptional<string>;
  declare sourceName: string;
  declare sourceSnapshot: JsonObject;
  declare status: NotionImportBatchStatus;
  declare report: JsonObject;
  declare validatedByUserId: ForeignKey<User["id"]> | null;
  declare validatedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare entries?: NonAttribute<NotionImportEntry[]>;
  declare validatedBy?: NonAttribute<User | null>;
}

export class NotionImportEntry extends Model<
  InferAttributes<NotionImportEntry>,
  InferCreationAttributes<NotionImportEntry>
> {
  declare id: CreationOptional<string>;
  declare batchId: ForeignKey<NotionImportBatch["id"]>;
  declare sourcePageId: string;
  declare sourceUrl: string | null;
  declare rawContent: JsonObject;
  declare contentHash: string;
  declare previousContentHash: string | null;
  declare status: NotionImportEntryStatus;
  declare mappedSnapshot: JsonObject;
  declare mappingReport: JsonObject;
  declare lastSeenAt: Date;
  declare appliedCharacterId: ForeignKey<Character["id"]> | null;
  declare appliedByUserId: ForeignKey<User["id"]> | null;
  declare appliedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare batch?: NonAttribute<NotionImportBatch>;
  declare appliedCharacter?: NonAttribute<Character | null>;
  declare appliedBy?: NonAttribute<User | null>;
}
