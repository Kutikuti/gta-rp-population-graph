import type { ElementDefinition } from "cytoscape";

import { type PublicGraph, resolveApiAssetUrl } from "../api";

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

export const toCytoscapeElements = (graph: PublicGraph): ElementDefinition[] => [
  ...graph.nodes.map((node) => {
    const photoUrl = resolveApiAssetUrl(node.data.photoUrl);

    return {
      data: {
        ...node.data,
        photoUrl,
        displayLabel: photoUrl ? "" : getCharacterInitials(node.data.fullName || node.data.label)
      }
    };
  }),
  ...graph.edges
];
