import type { ElementDefinition } from "cytoscape";

import type { PublicGraph } from "../api";

export const toCytoscapeElements = (
  graph: PublicGraph,
  matchingIdSet: Set<string>
): ElementDefinition[] => [
  ...graph.nodes.map((node) => ({
    data: {
      ...node.data,
      isMatched: matchingIdSet.has(node.data.characterId)
    },
    classes: matchingIdSet.has(node.data.characterId) ? "matched" : ""
  })),
  ...graph.edges
];
