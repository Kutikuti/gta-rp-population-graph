import { ChangeHistory, ChangeRequest } from "./changes.js";
import { Character, CharacterRelationship, CharacterTag, Streamer, Tag } from "./character.js";
import { AdminAction, Ban, Role, User, UserIdentity } from "./identity.js";
import { NotionImportBatch, NotionImportEntry } from "./notion.js";

export const associateModels = () => {
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });
  User.belongsTo(Role, { foreignKey: "roleId", as: "role" });
  User.hasMany(UserIdentity, { foreignKey: "userId", as: "identities" });
  UserIdentity.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Ban, { foreignKey: "userId", as: "bans" });
  Ban.belongsTo(User, { foreignKey: "userId", as: "user" });
  Ban.belongsTo(User, { foreignKey: "bannedByUserId", as: "bannedBy" });

  User.hasMany(AdminAction, { foreignKey: "actorUserId", as: "adminActions" });
  User.hasMany(AdminAction, { foreignKey: "targetUserId", as: "targetedAdminActions" });
  AdminAction.belongsTo(User, { foreignKey: "actorUserId", as: "actor" });
  AdminAction.belongsTo(User, { foreignKey: "targetUserId", as: "targetUser" });

  User.hasMany(NotionImportBatch, {
    foreignKey: "validatedByUserId",
    as: "validatedNotionImportBatches"
  });
  User.hasMany(NotionImportEntry, {
    foreignKey: "appliedByUserId",
    as: "appliedNotionImportEntries"
  });
  NotionImportBatch.belongsTo(User, { foreignKey: "validatedByUserId", as: "validatedBy" });
  NotionImportBatch.hasMany(NotionImportEntry, { foreignKey: "batchId", as: "entries" });
  NotionImportEntry.belongsTo(NotionImportBatch, { foreignKey: "batchId", as: "batch" });
  NotionImportEntry.belongsTo(User, { foreignKey: "appliedByUserId", as: "appliedBy" });
  Character.hasMany(NotionImportEntry, {
    foreignKey: "appliedCharacterId",
    as: "appliedNotionImportEntries"
  });
  NotionImportEntry.belongsTo(Character, {
    foreignKey: "appliedCharacterId",
    as: "appliedCharacter"
  });

  Streamer.hasMany(Character, { foreignKey: "streamerId", as: "characters" });
  Character.belongsTo(Streamer, { foreignKey: "streamerId", as: "streamer" });

  Character.belongsToMany(Tag, {
    through: CharacterTag,
    foreignKey: "characterId",
    otherKey: "tagId",
    as: "tags"
  });
  Tag.belongsToMany(Character, {
    through: CharacterTag,
    foreignKey: "tagId",
    otherKey: "characterId",
    as: "characters"
  });

  Character.hasMany(CharacterRelationship, {
    foreignKey: "sourceCharacterId",
    as: "outgoingRelationships"
  });
  Character.hasMany(CharacterRelationship, {
    foreignKey: "targetCharacterId",
    as: "incomingRelationships"
  });
  CharacterRelationship.belongsTo(Character, {
    foreignKey: "sourceCharacterId",
    as: "sourceCharacter"
  });
  CharacterRelationship.belongsTo(Character, {
    foreignKey: "targetCharacterId",
    as: "targetCharacter"
  });

  User.hasMany(ChangeRequest, { foreignKey: "userId", as: "changeRequests" });
  ChangeRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
  ChangeRequest.belongsTo(User, { foreignKey: "reviewerId", as: "reviewer" });
  Character.hasMany(ChangeRequest, { foreignKey: "characterId", as: "changeRequests" });
  ChangeRequest.belongsTo(Character, { foreignKey: "characterId", as: "character" });

  Character.hasMany(ChangeHistory, { foreignKey: "characterId", as: "changeHistory" });
  ChangeHistory.belongsTo(Character, { foreignKey: "characterId", as: "character" });
  ChangeHistory.belongsTo(ChangeRequest, { foreignKey: "changeRequestId", as: "changeRequest" });
  ChangeHistory.belongsTo(User, { foreignKey: "moderatorId", as: "moderator" });
};
