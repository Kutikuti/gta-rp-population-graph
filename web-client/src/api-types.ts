export type LifeStatus = "alive" | "deceased" | "left" | "unknown";
export type VerificationStatus = "verified" | "community" | "imported" | "to_check" | "disputed";
export type RoleName = "user" | "moderator" | "administrator";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";
type ChangeRequestType = "update" | "create";

type SocialLinks = Partial<
  Record<"twitch" | "kick" | "youtube" | "discord" | "instagram" | "tiktok", string>
>;

export type PublicStreamer = {
  id: string;
  publicName: string;
  primaryPlatform: string | null;
  socialLinks: SocialLinks | null;
  twitchLiveStatus: "live" | "offline" | "unknown";
  verificationStatus: VerificationStatus;
};

export type PublicTag = {
  id: string;
  name: string;
  type: string | null;
  colorHex: string;
  description: string | null;
};

type PublicCharacterSummary = {
  id: string;
  publicSlug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  lifeStatus: LifeStatus;
  phoneNumbers: string[];
  companyName: string | null;
  companyBadgeNumber: string | null;
  groupName: string | null;
  district: string | null;
  verificationStatus: VerificationStatus;
  dataSource: string;
  streamer: PublicStreamer | null;
  tags: PublicTag[];
  updatedAt: string;
};

export type PublicRelationship = {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: string;
  graphVisible: boolean;
  direction: string;
  label: string;
  description: string | null;
  source: string;
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
  companyRank: string | null;
  twitchLiveStatus: "live" | "offline" | "unknown";
  isRpDeath: boolean;
  previousCharacters: Record<string, string> | null;
  sourceNote: string | null;
  relationships: {
    outgoing: PublicRelationship[];
    incoming: PublicRelationship[];
  };
  createdAt: string;
};

export type PublicCharacterReference = {
  id: string;
  publicSlug: string;
  fullName: string;
};

export type PublicCharacterMatches = {
  ids: string[];
  total: number;
};

export type PublicGraph = {
  nodes: Array<{
    data: {
      id: string;
      type: "character";
      label: string;
      characterId: string;
      fullName: string;
      companyName: string | null;
      groupName: string | null;
      lifeStatus: LifeStatus;
      verificationStatus: VerificationStatus;
      photoUrl: string | null;
      streamerName: string | null;
      tagIds: string[];
    };
  }>;
  edges: Array<{
    data: {
      id: string;
      type: "relationship";
      source: string;
      target: string;
      label: string;
      relationshipType: string;
      direction: string;
      verificationStatus: VerificationStatus;
    };
  }>;
};

export type PublicHistoryEntry = {
  id: string;
  characterId: string;
  characterName: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

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
    provider: "google" | "discord" | "twitch";
    connectedAt: string;
    lastUsedAt: string | null;
    canUnlink: boolean;
  }>;
};

export type AuthSession =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: AuthenticatedUser;
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
    provider: "google" | "discord" | "twitch";
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
    lastUsedAt: string | null;
  }>;
};

export type CharacterFilters = {
  q: string;
  company: string;
  lifeStatus: "" | LifeStatus;
  tag: string;
  streamer: string;
  twitchLive: "" | "live";
  verificationStatus: "" | VerificationStatus;
};

type JsonObject = Record<string, unknown>;

export type CharacterSnapshot = {
  firstName: string;
  lastName: string;
  nickname: string | null;
  birthDate: string | null;
  lifeStatus: LifeStatus;
  deathOrDepartureDate: string | null;
  photoUrl: string | null;
  companyName: string | null;
  companyRank: string | null;
  companyBadgeNumber: string | null;
  phoneNumbers: string[];
  streamerId: string | null;
  streamerName: string | null;
  socialLinks: SocialLinks | null;
  groupName: string | null;
  district: string | null;
  isRpDeath: boolean;
  relationships: Array<{
    characterId: string;
    type:
      | "parent"
      | "child"
      | "sibling"
      | "couple"
      | "previous_character"
      | "ex_partner_reference"
      | "uncle_reference"
      | "aunt_reference";
  }>;
  previousCharacters: JsonObject | null;
  verificationStatus: VerificationStatus;
  sourceNote: string | null;
};

type FieldChange = {
  old: unknown;
  new: unknown;
};

export type ChangeDiff = Record<string, FieldChange>;

export type ChangeRequestSummary = {
  id: string;
  requestType: ChangeRequestType;
  characterId: string | null;
  characterName: string | null;
  proposedStreamerName: string | null;
  userId: string;
  userDisplayName: string | null;
  status: ChangeRequestStatus;
  proposedSnapshot: CharacterSnapshot;
  searchContext: CharacterCreationContext | null;
  reviewerId: string | null;
  reviewerDisplayName: string | null;
  moderatorComment: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CharacterCreationContext = CharacterFilters & {
  matchTotal: number;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUserPersonalDataExport = {
  exportedAt: string;
  user: AdminUser;
  linkedIdentities: Array<{
    id: string;
    provider: "google" | "discord" | "twitch";
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
    lastUsedAt: string | null;
  }>;
  sessions: {
    total: number;
    active: number;
    latestExpiryAt: string | null;
  };
  contributions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    latestRequestAt: string | null;
  };
  moderationTrace: {
    changeHistoriesAsModerator: number;
    adminActionsAsActor: number;
    latestAdminActionAt: string | null;
  };
};

export type AdminUserSessionRevocationResult = {
  status: "revoked";
  revokedCount: number;
};

export type AdminUserIdentityUnlinkResult = {
  status: "unlinked";
  provider: "google" | "discord" | "twitch";
};

export type AdminUserAnonymizationResult = {
  status: "anonymized";
  user: AdminUser;
  revokedSessions: number;
  unlinkedIdentities: number;
};

export type AdminTag = {
  id: string;
  name: string;
  type: "family" | "district" | "organization" | "business" | "other" | null;
  colorHex: string;
  description: string | null;
  usageCount: number;
};

type AdminActionEntry = {
  id: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  targetUser: {
    id: string;
    displayName: string;
  } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type AdminDashboard = {
  users: AdminUser[];
  tags: AdminTag[];
  actions: AdminActionEntry[];
};

type DataCompletenessItem = {
  id: string;
  publicSlug: string;
  fullName: string;
  verificationStatus: VerificationStatus;
  dataSource: string;
  missingFields: Array<{
    key: string;
    label: string;
  }>;
  attentionFlags: string[];
  updatedAt: string;
};

export type DataCompletenessReport = {
  summary: {
    total: number;
    withMissingFields: number;
    importedOrCommunity: number;
    needsReview: number;
  };
  items: DataCompletenessItem[];
};

export type AdminNotionImportBatch = {
  id: string;
  sourceName: string;
  status: string;
  sourceSnapshot: Record<string, unknown>;
  totals: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotionImportEntry = {
  status: "new" | "updated" | "unchanged" | "missing" | "failed";
  pageId: string;
  fullName: string;
  lifeStatus: string | null;
  streamer: string | null;
  socialLinks: SocialLinks | null;
  company: string | null;
  group: string | null;
  tags: string;
  photoReferences: string[];
  sourceUrl: string | null;
  rawContent: Record<string, unknown>;
  mappedSnapshot: Record<string, unknown>;
  mappingReport: Record<string, unknown>;
  appliedCharacterId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type AdminNotionImportDetail = {
  batch: AdminNotionImportBatch;
  entries: AdminNotionImportEntry[];
};

export type ApplyAdminNotionImportEntryResult = {
  status: "applied";
  entry: AdminNotionImportEntry;
  characterId: string;
  created: boolean;
};

export type ImportAdminNotionEntryPhotoResult = {
  status: "imported";
  entry: AdminNotionImportEntry;
  characterId: string;
  photoUrl: string;
};

export type AdminTagInput = {
  name: string;
  type: AdminTag["type"];
  colorHex: string;
  description: string | null;
};
