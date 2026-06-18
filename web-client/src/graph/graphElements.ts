import type { ElementDefinition } from "cytoscape";

import type { PublicGraph } from "../api";

const getCharacterInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/[\s'-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
};

export const toCytoscapeElements = (
  graph: PublicGraph,
  matchingIdSet: Set<string>,
  isSearchActive: boolean
): ElementDefinition[] => [
  ...graph.nodes.map((node) => {
    const isMatched = matchingIdSet.has(node.data.characterId);

    return {
      data: {
        ...node.data,
        displayLabel: getCharacterInitials(node.data.fullName || node.data.label),
        isMatched
      },
      classes: isSearchActive ? (isMatched ? "matched" : "search-muted") : ""
    };
  }),
  ...graph.edges.map((edge) => {
    const isMatched = matchingIdSet.has(edge.data.source) && matchingIdSet.has(edge.data.target);

    return {
      ...edge,
      classes: isSearchActive && !isMatched ? "search-muted" : ""
    };
  })
];
