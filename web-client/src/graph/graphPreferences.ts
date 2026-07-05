import type { PublicGraph } from "../api";
import type { GraphLayoutMode } from "./graphLayout";

export const supportedGraphRelationshipTypes = ["parent", "child", "sibling", "couple"] as const;
export const optionalGraphRelationshipTypes = [
  "previous_character",
  "ex_partner_reference",
  "uncle_reference",
  "aunt_reference"
] as const;
export const allGraphRelationshipTypes = [
  ...supportedGraphRelationshipTypes,
  ...optionalGraphRelationshipTypes
] as const;

export type GraphRelationshipType = (typeof allGraphRelationshipTypes)[number];

export type GraphPreferences = {
  layoutMode: GraphLayoutMode;
  showDeceased: boolean;
  visibleRelationshipTypes: GraphRelationshipType[];
};

export const initialGraphPreferences: GraphPreferences = {
  layoutMode: "grouped",
  showDeceased: false,
  visibleRelationshipTypes: [...supportedGraphRelationshipTypes]
};

const isGraphRelationshipType = (value: string): value is GraphRelationshipType =>
  allGraphRelationshipTypes.includes(value as GraphRelationshipType);

export const normalizeGraphPreferences = (value: unknown): GraphPreferences => {
  if (!value || typeof value !== "object") {
    return initialGraphPreferences;
  }

  const candidate = value as Partial<GraphPreferences>;
  const layoutMode =
    candidate.layoutMode === "network" ||
    candidate.layoutMode === "grouped" ||
    candidate.layoutMode === "company"
      ? candidate.layoutMode
      : initialGraphPreferences.layoutMode;
  const showDeceased =
    typeof candidate.showDeceased === "boolean"
      ? candidate.showDeceased
      : initialGraphPreferences.showDeceased;
  const visibleRelationshipTypes = Array.isArray(candidate.visibleRelationshipTypes)
    ? candidate.visibleRelationshipTypes.filter(
        (entry): entry is GraphRelationshipType =>
          typeof entry === "string" && isGraphRelationshipType(entry)
      )
    : initialGraphPreferences.visibleRelationshipTypes;

  return {
    layoutMode,
    showDeceased,
    visibleRelationshipTypes:
      visibleRelationshipTypes.length > 0
        ? [...new Set(visibleRelationshipTypes)]
        : initialGraphPreferences.visibleRelationshipTypes
  };
};

export const filterGraphForPreferences = (
  graph: PublicGraph | null,
  preferences: GraphPreferences
): PublicGraph | null => {
  if (!graph) {
    return null;
  }

  const visibleNodeIds = new Set(
    graph.nodes
      .filter((node) => preferences.showDeceased || node.data.lifeStatus !== "deceased")
      .map((node) => node.data.characterId)
  );
  const allowedRelationshipTypes = new Set(preferences.visibleRelationshipTypes);

  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.data.characterId)),
    edges: graph.edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.data.source) &&
        visibleNodeIds.has(edge.data.target) &&
        allowedRelationshipTypes.has(edge.data.relationshipType as GraphRelationshipType)
    )
  };
};
