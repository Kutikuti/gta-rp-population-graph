import { describe, expect, it } from "vitest";

import type { PublicGraph } from "../api";
import {
  filterGraphForPreferences,
  initialGraphPreferences,
  normalizeGraphPreferences
} from "./graphPreferences";

const graph: PublicGraph = {
  nodes: [
    {
      data: {
        id: "char-1",
        type: "character",
        label: "Camille Morel",
        characterId: "char-1",
        fullName: "Camille Morel",
        companyName: "Blue Line Logistics",
        groupName: "Quartier Nord",
        lifeStatus: "alive",
        verificationStatus: "community",
        photoUrl: null,
        streamerName: null,
        tagIds: []
      }
    },
    {
      data: {
        id: "char-2",
        type: "character",
        label: "Ines Morel",
        characterId: "char-2",
        fullName: "Ines Morel",
        companyName: null,
        groupName: "Quartier Nord",
        lifeStatus: "deceased",
        verificationStatus: "community",
        photoUrl: null,
        streamerName: null,
        tagIds: []
      }
    }
  ],
  edges: [
    {
      data: {
        id: "edge-1",
        type: "relationship",
        source: "char-1",
        target: "char-2",
        label: "Fratrie",
        relationshipType: "sibling",
        direction: "symmetric",
        verificationStatus: "community"
      }
    },
    {
      data: {
        id: "edge-2",
        type: "relationship",
        source: "char-1",
        target: "char-1",
        label: "Couple",
        relationshipType: "couple",
        direction: "symmetric",
        verificationStatus: "community"
      }
    }
  ]
};

describe("graphPreferences", () => {
  it("normalizes partial or invalid stored values", () => {
    expect(normalizeGraphPreferences(null)).toEqual(initialGraphPreferences);
    expect(
      normalizeGraphPreferences({
        layoutMode: "company",
        showDeceased: false,
        visibleRelationshipTypes: ["sibling", "invalid", "aunt_reference", "sibling"]
      })
    ).toEqual({
      layoutMode: "company",
      showDeceased: false,
      visibleRelationshipTypes: ["sibling", "aunt_reference"]
    });
  });

  it("filters deceased nodes and unsupported relationship types from the displayed graph", () => {
    const filteredGraph = filterGraphForPreferences(graph, {
      layoutMode: "grouped",
      showDeceased: false,
      visibleRelationshipTypes: ["couple"]
    });

    expect(filteredGraph?.nodes.map((node) => node.data.characterId)).toEqual(["char-1"]);
    expect(filteredGraph?.edges.map((edge) => edge.data.id)).toEqual(["edge-2"]);
  });

  it("keeps optional relationship types hidden by default", () => {
    const filteredGraph = filterGraphForPreferences(
      {
        ...graph,
        edges: [
          ...graph.edges,
          {
            data: {
              id: "edge-3",
              type: "relationship",
              source: "char-1",
              target: "char-1",
              label: "Ancien personnage",
              relationshipType: "previous_character",
              direction: "symmetric",
              verificationStatus: "community"
            }
          }
        ]
      },
      initialGraphPreferences
    );

    expect(filteredGraph?.edges.map((edge) => edge.data.id)).toEqual(["edge-1", "edge-2"]);
  });
});
