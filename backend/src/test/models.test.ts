import { afterAll, describe, expect, it } from "vitest";

import {
  changeRequestStatuses,
  lifeStatuses,
  relationshipTypes,
  roleNames,
  verificationStatuses
} from "../db/enums.js";
import { initModels } from "../db/models/index.js";
import { createSequelize } from "../db/sequelize.js";

const sequelize = createSequelize();
const models = initModels(sequelize);

afterAll(async () => {
  await sequelize.close();
});

describe("database models", () => {
  it("registers the expected business models", () => {
    expect(Object.keys(sequelize.models).sort()).toEqual([
      "AdminAction",
      "Ban",
      "ChangeHistory",
      "ChangeRequest",
      "Character",
      "CharacterRelationship",
      "CharacterTag",
      "Role",
      "Streamer",
      "Tag",
      "User"
    ]);
  });

  it("keeps controlled vocabulary for roles, statuses and RP relationships", () => {
    expect(roleNames).toEqual(["user", "moderator", "administrator"]);
    expect(lifeStatuses).toEqual(["alive", "deceased", "left", "unknown"]);
    expect(verificationStatuses).toContain("to_check");
    expect(relationshipTypes).toEqual(["parent", "child", "sibling", "couple"]);
    expect(changeRequestStatuses).toEqual(["pending", "approved", "rejected"]);
  });

  it("defines relationships needed by the graph and moderation workflows", () => {
    expect(Object.keys(models.Character.associations)).toEqual(
      expect.arrayContaining(["streamer", "tags", "outgoingRelationships", "incomingRelationships"])
    );
    expect(Object.keys(models.CharacterRelationship.associations)).toEqual(
      expect.arrayContaining(["sourceCharacter", "targetCharacter"])
    );
    expect(Object.keys(models.ChangeRequest.associations)).toEqual(
      expect.arrayContaining(["user", "character", "reviewer"])
    );
    expect(Object.keys(models.ChangeHistory.associations)).toEqual(
      expect.arrayContaining(["character", "changeRequest", "moderator"])
    );
  });
});
