import {
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute
} from "sequelize";

import type { ChangeRequestStatus, ChangeRequestType } from "../enums.js";
import type { Character } from "./character.js";
import type { User } from "./identity.js";
import type { JsonObject } from "./shared.js";

export class ChangeRequest extends Model<
  InferAttributes<ChangeRequest>,
  InferCreationAttributes<ChangeRequest>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare requestType: ChangeRequestType;
  declare characterId: ForeignKey<Character["id"]> | null;
  declare proposedSnapshot: JsonObject;
  declare searchContext: JsonObject | null;
  declare status: ChangeRequestStatus;
  declare reviewerId: ForeignKey<User["id"]> | null;
  declare moderatorComment: string | null;
  declare resolvedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare character?: NonAttribute<Character>;
  declare reviewer?: NonAttribute<User | null>;
}

export class ChangeHistory extends Model<
  InferAttributes<ChangeHistory>,
  InferCreationAttributes<ChangeHistory>
> {
  declare id: CreationOptional<string>;
  declare characterId: ForeignKey<Character["id"]>;
  declare changeRequestId: ForeignKey<ChangeRequest["id"]> | null;
  declare moderatorId: ForeignKey<User["id"]> | null;
  declare changes: JsonObject;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare character?: NonAttribute<Character>;
  declare changeRequest?: NonAttribute<ChangeRequest | null>;
  declare moderator?: NonAttribute<User | null>;
}
