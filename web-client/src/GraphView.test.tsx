import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({ useCytoscapeGraph: vi.fn() }));

vi.mock("./graph/useCytoscapeGraph", () => ({ useCytoscapeGraph: mockState.useCytoscapeGraph }));

import type { PublicGraph } from "./api";
import GraphView from "./GraphView";

const graph: PublicGraph = { nodes: [], edges: [] };

it("renders the labelled graph surface and forwards its exploration state", () => {
  const onSelect = vi.fn();
  render(
    <GraphView
      graph={graph}
      layoutMode="company"
      matchingIds={["character-a", "character-b"]}
      isSearchActive
      selectedId="character-a"
      onSelect={onSelect}
    />
  );

  expect(screen.getByRole("img", { name: "Graphe interactif des personnages" })).toHaveClass(
    "graph-canvas"
  );
  expect(mockState.useCytoscapeGraph).toHaveBeenCalledWith(
    expect.objectContaining({
      graph,
      isSearchActive: true,
      layoutMode: "company",
      matchingIdSet: new Set(["character-a", "character-b"]),
      onSelect,
      selectedId: "character-a"
    })
  );
});
