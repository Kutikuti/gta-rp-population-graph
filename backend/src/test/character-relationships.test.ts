import { describe, expect, it } from "vitest";

import {
  canonicalRelationshipKey,
  canonicalRelationshipRecord,
  invertRelationshipType,
  isEditableRelationshipType,
  isGraphRelationshipType,
  relationshipDefinitionByType,
  relationshipGraphVisible,
  relationshipTypeForCharacterView
} from "../services/character-relationships.js";

describe("character relationship definitions", () => {
  it("keeps graph visibility explicit by relationship type", () => {
    expect(isGraphRelationshipType("parent")).toBe(true);
    expect(isGraphRelationshipType("couple")).toBe(true);
    expect(isGraphRelationshipType("previous_character")).toBe(false);
    expect(isGraphRelationshipType("aunt_reference")).toBe(false);
    expect(relationshipGraphVisible("ex_partner_reference")).toBe(false);
  });

  it("allows editing every managed relationship type", () => {
    expect(isEditableRelationshipType("parent")).toBe(true);
    expect(isEditableRelationshipType("sibling")).toBe(true);
    expect(isEditableRelationshipType("previous_character")).toBe(true);
    expect(isEditableRelationshipType("ex_partner_reference")).toBe(true);
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

  it("normalizes child relationships to the same canonical key as their inverse parent link", () => {
    expect(canonicalRelationshipRecord("child", "directed", "parent-1", "child-1")).toEqual({
      type: "parent",
      direction: "directed",
      sourceCharacterId: "child-1",
      targetCharacterId: "parent-1"
    });
    expect(canonicalRelationshipKey("child", "directed", "parent-1", "child-1")).toBe(
      canonicalRelationshipKey("parent", "directed", "child-1", "parent-1")
    );
  });

  it("inverts a directed relationship when viewed from the other character", () => {
    expect(relationshipTypeForCharacterView("parent", "directed", "child-1", "child-1")).toBe(
      "parent"
    );
    expect(relationshipTypeForCharacterView("parent", "directed", "child-1", "parent-1")).toBe(
      "child"
    );
  });
});
