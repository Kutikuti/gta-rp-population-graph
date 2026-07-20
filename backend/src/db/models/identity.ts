import {
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute
} from "sequelize";

import type { AuthProvider, RoleName } from "../enums.js";
import type { JsonObject } from "./shared.js";

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<string>;
  declare name: RoleName;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare displayName: string;
  declare displayNameChosenAt: Date | null;
  declare avatarUrl: string | null;
  declare roleId: ForeignKey<Role["id"]>;
  declare lastLoginAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare role?: NonAttribute<Role>;
  declare bans?: NonAttribute<Ban[]>;
  declare identities?: NonAttribute<UserIdentity[]>;
}

export class UserIdentity extends Model<
  InferAttributes<UserIdentity>,
  InferCreationAttributes<UserIdentity>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare provider: AuthProvider;
  declare providerUserId: string;
  declare providerEmail: string | null;
  declare providerDisplayName: string | null;
  declare providerAvatarUrl: string | null;
  declare lastUsedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

export class Ban extends Model<InferAttributes<Ban>, InferCreationAttributes<Ban>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare bannedByUserId: ForeignKey<User["id"]> | null;
  declare reason: string;
  declare expiresAt: Date | null;
  declare revokedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare bannedBy?: NonAttribute<User>;
}

export class AdminAction extends Model<
  InferAttributes<AdminAction>,
  InferCreationAttributes<AdminAction>
> {
  declare id: CreationOptional<string>;
  declare actorUserId: ForeignKey<User["id"]> | null;
  declare targetUserId: ForeignKey<User["id"]> | null;
  declare action: string;
  declare targetType: string;
  declare targetId: string | null;
  declare changes: JsonObject;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare actor?: NonAttribute<User | null>;
  declare targetUser?: NonAttribute<User | null>;
}

export class UserSession extends Model<
  InferAttributes<UserSession>,
  InferCreationAttributes<UserSession>
> {
  declare sid: string;
  declare data: JsonObject;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
