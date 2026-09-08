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

const templateNode = graph.nodes[0];
if (!templateNode) throw new Error("Missing graph fixture");
const templateData = templateNode.data;

describe("graphLayoutOptions", () => {
  it("keeps dense circular clusters separated on a mobile viewport", () => {
    const denseGraph: PublicGraph = {
      nodes: Array.from({ length: 150 }, (_, index) => ({
        data: {
          ...templateData,
          id: String(index),
          characterId: String(index),
          fullName: `Personnage ${index}`,
          companyName: index < 120 ? "A" : "B"
        }
      })),
      edges: []
    };
    const layout = graphLayoutOptions(denseGraph, "company", { width: 375, height: 667 }) as {
      positions: Record<string, { x: number; y: number }>;
    };
    const points = Object.values(layout.positions);
    expect(points).toHaveLength(150);
    for (const [index, point] of points.entries()) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      for (const other of points.slice(index + 1)) {
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(119.99);
      }
    }
    const reordered = graphLayoutOptions(
      { ...denseGraph, nodes: [...denseGraph.nodes].reverse() },
      "company",
      { width: 375, height: 667 }
    ) as { positions: Record<string, { x: number; y: number }> };
    expect(reordered.positions).toEqual(layout.positions);
  });

  it("keeps imported empty company values in a compact neutral cluster", () => {
    const importedGraph: PublicGraph = {
      nodes: Array.from({ length: 48 }, (_, index) => ({
        data: {
          ...templateData,
          id: String(index),
          characterId: String(index),
          fullName: `Personnage ${index}`,
          companyName: "Aucun métier/entreprise"
        }
      })),
      edges: []
    };

    const layout = graphLayoutOptions(importedGraph, "company", { width: 375, height: 667 }) as {
      positions: Record<string, { x: number; y: number }>;
    };
    const points = Object.values(layout.positions);

    expect(points).toHaveLength(48);
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(48);
    const horizontalSpan =
      Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const verticalSpan =
      Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    expect(horizontalSpan).toBeLessThanOrEqual(545);
    expect(verticalSpan).toBeLessThanOrEqual(545);

    const reordered = graphLayoutOptions(
      { ...importedGraph, nodes: [...importedGraph.nodes].reverse() },
      "company",
      { width: 375, height: 667 }
    ) as { positions: Record<string, { x: number; y: number }> };
    expect(reordered.positions).toEqual(layout.positions);
  });

  it("places a small group on a circle", () => {
    const circleGraph: PublicGraph = {
      nodes: Array.from({ length: 5 }, (_, i) => ({
        data: { ...templateData, id: String(i), characterId: String(i) }
      })),
      edges: []
    };
    const layout = graphLayoutOptions(circleGraph, "company", { width: 800, height: 800 }) as {
      positions: Record<string, { x: number; y: number }>;
    };
    for (const point of Object.values(layout.positions)) {
      expect(Math.hypot(point.x - 400, point.y - 400)).toBeCloseTo(120);
    }
  });
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
