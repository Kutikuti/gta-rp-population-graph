export const roleNames = ["user", "moderator", "administrator"] as const;
export type RoleName = (typeof roleNames)[number];

export const lifeStatuses = ["alive", "deceased", "left", "unknown"] as const;
export type LifeStatus = (typeof lifeStatuses)[number];

export const verificationStatuses = [
  "verified",
  "community",
  "imported",
  "to_check",
  "disputed"
] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const dataSources = ["notion", "moderation", "contribution", "seed", "other"] as const;
export type DataSource = (typeof dataSources)[number];

export const tagTypes = ["family", "district", "organization", "business", "other"] as const;
export type TagType = (typeof tagTypes)[number];

export const graphRelationshipTypes = ["parent", "child", "sibling", "couple"] as const;
export const informativeRelationshipTypes = [
  "previous_character",
  "couple_reference",
  "aunt_or_uncle_reference",
  "ex_partner_reference",
  "uncle_reference",
  "aunt_reference"
] as const;
export const relationshipTypes = [
  ...graphRelationshipTypes,
  ...informativeRelationshipTypes
] as const;
export type RelationshipType = (typeof relationshipTypes)[number];
export const editableRelationshipTypes = graphRelationshipTypes;

export const relationshipDirections = ["directed", "symmetric"] as const;
export type RelationshipDirection = (typeof relationshipDirections)[number];

export const changeRequestStatuses = ["pending", "approved", "rejected"] as const;
export type ChangeRequestStatus = (typeof changeRequestStatuses)[number];

export const changeRequestTypes = ["update", "create"] as const;
export type ChangeRequestType = (typeof changeRequestTypes)[number];

export const notionImportBatchStatuses = ["draft", "mapped", "reported", "failed"] as const;
export type NotionImportBatchStatus = (typeof notionImportBatchStatuses)[number];

export const notionImportEntryStatuses = [
  "new",
  "updated",
  "unchanged",
  "missing",
  "failed"
] as const;
export type NotionImportEntryStatus = (typeof notionImportEntryStatuses)[number];
