import { describe, expect, it } from "vitest";

import {
  invertRelationshipType,
  isEditableRelationshipType,
  isGraphRelationshipType,
  relationshipDefinitionByType,
  relationshipGraphVisible
} from "../services/character-relationships.js";

describe("character relationship definitions", () => {
  it("keeps graph visibility explicit by relationship type", () => {
    expect(isGraphRelationshipType("parent")).toBe(true);
    expect(isGraphRelationshipType("couple")).toBe(true);
    expect(isGraphRelationshipType("previous_character")).toBe(false);
    expect(isGraphRelationshipType("aunt_reference")).toBe(false);
    expect(relationshipGraphVisible("ex_partner_reference")).toBe(false);
  });

  it("limits editable relationship types to the RP graph core", () => {
    expect(isEditableRelationshipType("parent")).toBe(true);
    expect(isEditableRelationshipType("sibling")).toBe(true);
    expect(isEditableRelationshipType("previous_character")).toBe(false);
    expect(isEditableRelationshipType("couple_reference")).toBe(false);
  });

  it("keeps inverse and display metadata coherent", () => {
    expect(invertRelationshipType("parent")).toBe("child");
    expect(invertRelationshipType("child")).toBe("parent");
    expect(invertRelationshipType("previous_character")).toBe("previous_character");
    expect(relationshipDefinitionByType.previous_character).toMatchObject({
      label: "Ancien personnage",
      direction: "directed",
      graphVisible: false
    });
  });
});
