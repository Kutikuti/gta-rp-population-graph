import type { AuthProvider, RoleName } from "../db/enums.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  mustChooseDisplayName: boolean;
  avatarUrl: string | null;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  linkedIdentities: Array<{
    id: string;
    provider: AuthProvider;
    connectedAt: string;
    lastUsedAt: string | null;
    canUnlink: boolean;
  }>;
};

export type ExternalIdentity = {
  provider: AuthProvider;
  providerUserId: string;
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
    }
  | {
      status: "email_in_use";
    };

export type LinkIdentityResult =
  | {
      status: "linked";
      user: AuthenticatedUser;
    }
  | {
      status: "already_linked";
      user: AuthenticatedUser;
    }
  | {
      status: "linked_to_other_user";
    }
  | {
      status: "different_identity_already_linked";
    };

export type PersonalDataExport = {
  exportedAt: string;
  account: {
    id: string;
    email: string;
    displayName: string;
    displayNameChosenAt: string | null;
    avatarUrl: string | null;
    role: RoleName;
    isBanned: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  linkedIdentities: Array<{
    id: string;
    provider: AuthProvider;
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
    lastUsedAt: string | null;
  }>;
};

export interface AuthService {
  getSessionUser(userId: string): Promise<AuthenticatedUser | null>;
  authenticateIdentity(identity: ExternalIdentity): Promise<AuthResult>;
  linkIdentity(userId: string, identity: ExternalIdentity): Promise<LinkIdentityResult | null>;
  updateDisplayName(userId: string, displayName: string): Promise<AuthenticatedUser | null>;
  exportPersonalData?(userId: string): Promise<PersonalDataExport | null>;
  unlinkIdentity(
    userId: string,
    provider: AuthProvider
  ): Promise<AuthenticatedUser | "last_identity" | null>;
}
