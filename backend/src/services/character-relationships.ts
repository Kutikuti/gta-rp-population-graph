import type { RelationshipDirection, RelationshipType } from "../db/enums.js";
import {
  editableRelationshipTypes,
  graphRelationshipTypes,
  informativeRelationshipTypes
} from "../db/enums.js";

type RelationshipDefinition = {
  label: string;
  direction: RelationshipDirection;
  graphVisible: boolean;
  inverseType?: RelationshipType;
};

export const relationshipDefinitionByType: Record<RelationshipType, RelationshipDefinition> = {
  // Core graph relationships: explicit RP links that are intended to structure the public graph.
  parent: {
    label: "Parent",
    direction: "directed",
    graphVisible: true,
    inverseType: "child"
  },
  child: {
    label: "Enfant",
    direction: "directed",
    graphVisible: true,
    inverseType: "parent"
  },
  sibling: {
    label: "Fratrie",
    direction: "symmetric",
    graphVisible: true
  },
  couple: {
    label: "Couple",
    direction: "symmetric",
    graphVisible: true
  },
  // Informative relationships: kept in sheets/history/imports, but hidden from the graph by default.
  previous_character: {
    label: "Ancien personnage",
    direction: "directed",
    graphVisible: false
  },
  ex_partner_reference: {
    label: "Ex",
    direction: "symmetric",
    graphVisible: false
  },
  uncle_reference: {
    label: "Oncle",
    direction: "directed",
    graphVisible: false
  },
  aunt_reference: {
    label: "Tante",
    direction: "directed",
    graphVisible: false
  }
};

const graphRelationshipTypeSet = new Set<RelationshipType>(graphRelationshipTypes);
const editableRelationshipTypeSet = new Set<RelationshipType>(editableRelationshipTypes);
const informativeRelationshipTypeSet = new Set<RelationshipType>(informativeRelationshipTypes);

export const isGraphRelationshipType = (
  value: RelationshipType
): value is (typeof graphRelationshipTypes)[number] => graphRelationshipTypeSet.has(value);

export const isEditableRelationshipType = (
  value: RelationshipType
): value is (typeof editableRelationshipTypes)[number] => editableRelationshipTypeSet.has(value);

export const isInformativeRelationshipType = (
  value: RelationshipType
): value is (typeof informativeRelationshipTypes)[number] =>
  informativeRelationshipTypeSet.has(value);

export const relationshipLabel = (type: RelationshipType) =>
  relationshipDefinitionByType[type].label;

export const relationshipDirection = (type: RelationshipType) =>
  relationshipDefinitionByType[type].direction;

export const relationshipGraphVisible = (type: RelationshipType) =>
  relationshipDefinitionByType[type].graphVisible;

export const invertRelationshipType = (type: RelationshipType) =>
  relationshipDefinitionByType[type].inverseType ?? type;

export const relationshipTypeForCharacterView = (
  type: RelationshipType,
  direction: RelationshipDirection,
  sourceCharacterId: string,
  currentCharacterId: string
) =>
  direction === "directed" && sourceCharacterId !== currentCharacterId
    ? invertRelationshipType(type)
    : type;

export const canonicalRelationshipRecord = (
  type: RelationshipType,
  direction: RelationshipDirection,
  sourceCharacterId: string,
  targetCharacterId: string
): {
  type: RelationshipType;
  direction: RelationshipDirection;
  sourceCharacterId: string;
  targetCharacterId: string;
} => {
  if (direction === "symmetric") {
    const sortedPair = [sourceCharacterId, targetCharacterId].sort((a, b) =>
      a.localeCompare(b, "fr")
    );

    return {
      type,
      direction,
      sourceCharacterId: sortedPair[0] ?? sourceCharacterId,
      targetCharacterId: sortedPair[1] ?? targetCharacterId
    };
  }

  if (type === "child") {
    return {
      type: "parent" as const,
      direction,
      sourceCharacterId: targetCharacterId,
      targetCharacterId: sourceCharacterId
    };
  }

  return {
    type,
    direction,
    sourceCharacterId,
    targetCharacterId
  };
};

export const canonicalRelationshipKey = (
  type: RelationshipType,
  direction: RelationshipDirection,
  sourceCharacterId: string,
  targetCharacterId: string
) => {
  const canonical = canonicalRelationshipRecord(
    type,
    direction,
    sourceCharacterId,
    targetCharacterId
  );

  return `${canonical.type}:${canonical.sourceCharacterId}:${canonical.targetCharacterId}`;
};
