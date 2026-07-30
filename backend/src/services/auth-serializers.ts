import { Op } from "sequelize";

import type { AuthProvider, RoleName } from "../db/enums.js";
import type { AuthenticatedUser, PersonalDataExport } from "./auth-types.js";

type SessionUserRecord = {
  id: string;
  email: string;
  displayName: string;
  displayNameChosenAt: Date | null;
  avatarUrl: string | null;
  role?: { id: string; name: RoleName } | null;
  bans?: Array<{ id: string }>;
  identities?: Array<{
    id: string;
    provider: AuthProvider;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
};

type PersonalDataUserRecord = Omit<SessionUserRecord, "identities"> & {
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identities?: Array<{
    id: string;
    provider: AuthProvider;
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
};

export const activeBanWhere = () => ({
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
});

export const serializeAuthenticatedUser = (user: SessionUserRecord): AuthenticatedUser => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    mustChooseDisplayName: !user.displayNameChosenAt,
    avatarUrl: user.avatarUrl,
    role: {
      id: user.role.id,
      name: user.role.name
    },
    isBanned: Boolean(user.bans?.length),
    linkedIdentities: (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      connectedAt: identity.createdAt.toISOString(),
      lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null,
      canUnlink: (user.identities?.length ?? 0) > 1
    }))
  };
};

export const serializePersonalDataExport = (user: PersonalDataUserRecord): PersonalDataExport => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      displayNameChosenAt: user.displayNameChosenAt ? user.displayNameChosenAt.toISOString() : null,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      isBanned: Boolean(user.bans?.length),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    },
    linkedIdentities: (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerEmail: identity.providerEmail,
      providerDisplayName: identity.providerDisplayName,
      providerAvatarUrl: identity.providerAvatarUrl,
      connectedAt: identity.createdAt.toISOString(),
      lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null
    }))
  };
};
