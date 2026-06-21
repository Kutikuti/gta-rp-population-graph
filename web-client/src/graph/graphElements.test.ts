import { describe, expect, it } from "vitest";

import type { PublicGraph } from "../api";
import { toCytoscapeElements } from "./graphElements";

const baseNode: PublicGraph["nodes"][number]["data"] = {
  id: "00000000-0000-4000-8000-000000000301",
  type: "character",
  label: "Camille Morel",
  characterId: "00000000-0000-4000-8000-000000000301",
  fullName: "Camille Morel",
  lifeStatus: "alive",
  verificationStatus: "community",
  photoUrl: null,
  streamerName: null,
  tagIds: []
};

describe("toCytoscapeElements", () => {
  it("uses initials only when a character has no photo", () => {
    const graph: PublicGraph = {
      nodes: [
        {
          data: {
            ...baseNode,
            photoUrl: null
          }
        }
      ],
      edges: []
    };

    expect(toCytoscapeElements(graph)[0]?.data).toMatchObject({
      displayLabel: "CM",
      photoUrl: null
    });
  });

  it("hides initials when a character photo is available", () => {
    const graph: PublicGraph = {
      nodes: [
        {
          data: {
            ...baseNode,
            photoUrl: "/uploads/characters/camille.webp"
          }
        }
      ],
      edges: []
    };

    expect(toCytoscapeElements(graph)[0]?.data).toMatchObject({
      displayLabel: "",
      photoUrl: "http://localhost:4000/uploads/characters/camille.webp"
    });
  });
});
