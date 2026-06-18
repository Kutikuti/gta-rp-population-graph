import { Op } from "sequelize";

import type { RoleName } from "../db/enums.js";
import { models } from "../db/index.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
};

export type GoogleIdentity = {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AuthResult =
  | {
      status: "authenticated";
      user: AuthenticatedUser;
    }
  | {
      status: "banned";
      user: AuthenticatedUser;
    };

export interface AuthService {
  getSessionUser(userId: string): Promise<AuthenticatedUser | null>;
  authenticateGoogleIdentity(identity: GoogleIdentity): Promise<AuthResult>;
}

const activeBanWhere = {
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
};

const serializeAuthenticatedUser = (user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role?: { id: string; name: RoleName } | null;
  bans?: Array<{ id: string }>;
}): AuthenticatedUser => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: {
      id: user.role.id,
      name: user.role.name
    },
    isBanned: Boolean(user.bans?.length)
  };
};

export class SequelizeAuthService implements AuthService {
  async getSessionUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await models.User.findByPk(userId, {
      include: [
        { association: "role", attributes: ["id", "name"] },
        {
          association: "bans",
          attributes: ["id"],
          required: false,
          where: activeBanWhere
        }
      ]
    });

    if (!user) {
      return null;
    }

    return serializeAuthenticatedUser(user);
  }

  async authenticateGoogleIdentity(identity: GoogleIdentity): Promise<AuthResult> {
    const defaultRole = await models.Role.findOne({
      where: { name: "user" },
      attributes: ["id", "name"]
    });

    if (!defaultRole) {
      throw new Error('Role "user" is missing from the database.');
    }

    const now = new Date();
    const [user] = await models.User.findOrCreate({
      where: { googleId: identity.googleId },
      defaults: {
        googleId: identity.googleId,
        email: identity.email,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        roleId: defaultRole.id,
        lastLoginAt: now
      }
    });

    const updates: Partial<{
      email: string;
      displayName: string;
      avatarUrl: string | null;
      lastLoginAt: Date;
    }> = {
      lastLoginAt: now
    };

    if (user.email !== identity.email) {
      updates.email = identity.email;
    }

    if (user.displayName !== identity.displayName) {
      updates.displayName = identity.displayName;
    }

    if (user.avatarUrl !== identity.avatarUrl) {
      updates.avatarUrl = identity.avatarUrl;
    }

    await user.update(updates);

    const authenticatedUser = await this.getSessionUser(user.id);

    if (!authenticatedUser) {
      throw new Error(`User ${user.id} could not be reloaded after authentication.`);
    }

    return authenticatedUser.isBanned
      ? { status: "banned", user: authenticatedUser }
      : { status: "authenticated", user: authenticatedUser };
  }
}
