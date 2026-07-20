import type { Sequelize } from "sequelize";

import { associateModels } from "./associations.js";
import { ChangeHistory, ChangeRequest } from "./changes.js";
import { Character, CharacterRelationship, CharacterTag, Streamer, Tag } from "./character.js";
import { AdminAction, Ban, Role, User, UserIdentity, UserSession } from "./identity.js";
import { initChangeRequestModels } from "./init-changes.js";
import { initCharacterModels } from "./init-character.js";
import { initIdentityModels } from "./init-identity.js";
import { initNotionImportModels } from "./init-notion.js";
import { NotionImportBatch, NotionImportEntry } from "./notion.js";

export { ChangeRequest } from "./changes.js";
export { Character, CharacterRelationship, Streamer, Tag } from "./character.js";
export { AdminAction, User } from "./identity.js";
export { NotionImportBatch, NotionImportEntry } from "./notion.js";
export type { JsonObject, SocialLinks } from "./shared.js";

export const initModels = (sequelize: Sequelize) => {
  initIdentityModels(sequelize);
  initNotionImportModels(sequelize);
  initCharacterModels(sequelize);
  initChangeRequestModels(sequelize);
  associateModels();

  return {
    Role,
    User,
    UserIdentity,
    Ban,
    AdminAction,
    UserSession,
    NotionImportBatch,
    NotionImportEntry,
    Streamer,
    Character,
    Tag,
    CharacterTag,
    CharacterRelationship,
    ChangeRequest,
    ChangeHistory
  };
};
