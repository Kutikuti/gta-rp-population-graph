import { describe, expect, it } from "vitest";

import type { PublicGraph } from "../api";
import { graphLayoutOptions } from "./graphLayout";

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
        id: "char-3",
        type: "character",
        label: "Alix Mizuno",
        characterId: "char-3",
        fullName: "Alix Mizuno",
        companyName: "Mizuno Corp",
        groupName: "Mizuno",
        lifeStatus: "alive",
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
    }
  ]
};

describe("graphLayoutOptions", () => {
  it("returns grouped preset positions by default-ready mode", () => {
    const layout = graphLayoutOptions(graph, "grouped", { width: 1200, height: 800 });
    const presetLayout = layout as {
      name: string;
      positions: Record<string, { x: number; y: number }>;
    };

    expect(presetLayout.name).toBe("preset");
    expect(presetLayout.positions).toBeTruthy();

    const positions = graph.nodes.map((node) => presetLayout.positions[node.data.id]);

    expect(positions[0]).toBeTruthy();
    expect(positions[1]).toBeTruthy();
    expect(positions[2]).toBeTruthy();
    expect(positions[0]?.x).not.toBe(positions[2]?.x);
  });

  it("keeps the network mode on cose layout", () => {
    const layout = graphLayoutOptions(graph, "network", { width: 1200, height: 800 });

    expect(layout).toMatchObject({
      name: "cose",
      animate: false,
      fit: true
    });
  });

  it("can cluster positions by company", () => {
    const layout = graphLayoutOptions(graph, "company", { width: 1200, height: 800 });
    const presetLayout = layout as {
      name: string;
      positions: Record<string, { x: number; y: number }>;
    };

    expect(presetLayout.name).toBe("preset");
    expect(presetLayout.positions["char-1"]?.x).not.toBe(presetLayout.positions["char-3"]?.x);
  });

  it("can cluster positions by family relationships", () => {
    const layout = graphLayoutOptions(graph, "family", { width: 1200, height: 800 });
    const presetLayout = layout as {
      name: string;
      positions: Record<string, { x: number; y: number }>;
    };

    expect(presetLayout.name).toBe("preset");

    const char1 = presetLayout.positions["char-1"];
    const char2 = presetLayout.positions["char-2"];
    const char3 = presetLayout.positions["char-3"];

    const familyDistance =
      Math.abs((char1?.x ?? 0) - (char2?.x ?? 0)) + Math.abs((char1?.y ?? 0) - (char2?.y ?? 0));
    const outsiderDistance =
      Math.abs((char1?.x ?? 0) - (char3?.x ?? 0)) + Math.abs((char1?.y ?? 0) - (char3?.y ?? 0));

    expect(familyDistance).toBeLessThan(outsiderDistance);
  });
});
