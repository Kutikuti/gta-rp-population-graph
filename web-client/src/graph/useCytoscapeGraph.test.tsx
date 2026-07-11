import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  cytoscape: vi.fn(),
  graphLayoutOptions: vi.fn(),
  toCytoscapeElements: vi.fn()
}));

vi.mock("cytoscape", () => ({ default: mockState.cytoscape }));
vi.mock("./graphElements", () => ({ toCytoscapeElements: mockState.toCytoscapeElements }));
vi.mock("./graphLayout", () => ({ graphLayoutOptions: mockState.graphLayoutOptions }));
vi.mock("./cytoscapeStyles", () => ({ cytoscapeStyles: [{ selector: "node" }] }));

import type { PublicGraph } from "../api";
import { useCytoscapeGraph } from "./useCytoscapeGraph";

const graph: PublicGraph = {
  nodes: [
    {
      data: {
        id: "character-a",
        type: "character",
        label: "Camille Morel",
        characterId: "character-a",
        fullName: "Camille Morel",
        companyName: null,
        groupName: null,
        lifeStatus: "alive",
        verificationStatus: "community",
        photoUrl: null,
        streamerName: null,
        tagIds: []
      }
    }
  ],
  edges: []
};

const collection = () => {
  const value = {
    addClass: vi.fn(),
    removeClass: vi.fn(),
    removeStyle: vi.fn()
  };
  value.addClass.mockReturnValue(value);
  value.removeClass.mockReturnValue(value);
  value.removeStyle.mockReturnValue(value);
  return value;
};

const createCytoscapeFixture = () => {
  const nodeA = {
    addClass: vi.fn(),
    removeClass: vi.fn(),
    data: vi.fn((key: string): string | undefined =>
      key === "characterId" ? "character-a" : undefined
    )
  };
  const nodeB = {
    addClass: vi.fn(),
    removeClass: vi.fn(),
    data: vi.fn((key: string): string | undefined =>
      key === "characterId" ? "character-b" : undefined
    )
  };
  const edge = {
    addClass: vi.fn(),
    data: vi.fn((key: string) => (key === "source" ? "character-a" : "character-b"))
  };
  const allNodes = collection() as ReturnType<typeof collection> & {
    forEach: ReturnType<typeof vi.fn>;
  };
  allNodes.forEach = vi.fn((callback: (node: typeof nodeA) => void) => {
    callback(nodeA);
    callback(nodeB);
  });
  const allEdges = collection() as ReturnType<typeof collection> & {
    forEach: ReturnType<typeof vi.fn>;
  };
  allEdges.forEach = vi.fn((callback: (item: typeof edge) => void) => callback(edge));
  const selected = collection() as ReturnType<typeof collection> & {
    closedNeighborhood: ReturnType<typeof vi.fn>;
  };
  const neighborhood = collection();
  selected.closedNeighborhood = vi.fn(() => neighborhood);
  const outside = collection();
  const allElements = { not: vi.fn(() => outside) };
  const style = { setProperty: vi.fn() };
  const cy = {
    animate: vi.fn(),
    container: vi.fn(() => ({ style })),
    destroy: vi.fn(),
    edges: vi.fn(() => allEdges),
    elements: vi.fn(() => allElements),
    nodes: vi.fn((selector?: string) => (selector ? selected : allNodes)),
    on: vi.fn(),
    zoom: vi.fn(() => 0.8)
  };

  return {
    allEdges,
    allNodes,
    cy,
    edge,
    neighborhood,
    nodeA,
    nodeB,
    outside,
    selected,
    style
  };
};

describe("useCytoscapeGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.toCytoscapeElements.mockReturnValue([{ data: { id: "character-a" } }]);
    mockState.graphLayoutOptions.mockReturnValue({ name: "preset" });
  });

  it("creates, wires and destroys the Cytoscape instance", () => {
    const fixture = createCytoscapeFixture();
    mockState.cytoscape.mockReturnValue(fixture.cy);
    const container = document.createElement("div");
    const containerRef = { current: container };
    const onSelect = vi.fn();
    const onSelectUpdated = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ select }) =>
        useCytoscapeGraph({
          containerRef,
          graph,
          layoutMode: "company",
          matchingIdSet: new Set(),
          isSearchActive: false,
          selectedId: null,
          onSelect: select
        }),
      { initialProps: { select: onSelect } }
    );

    expect(mockState.cytoscape).toHaveBeenCalledWith(
      expect.objectContaining({
        container,
        elements: [{ data: { id: "character-a" } }],
        layout: { name: "preset" },
        maxZoom: 2.2,
        minZoom: 0.35
      })
    );
    expect(fixture.cy.on).toHaveBeenCalledTimes(3);

    const tapHandler = fixture.cy.on.mock.calls.find(([event]) => event === "tap")?.[2];
    const mouseOverHandler = fixture.cy.on.mock.calls.find(([event]) => event === "mouseover")?.[2];
    const mouseOutHandler = fixture.cy.on.mock.calls.find(([event]) => event === "mouseout")?.[2];
    tapHandler({ target: fixture.nodeA });
    expect(onSelect).toHaveBeenCalledWith("character-a");

    mouseOverHandler({ target: fixture.nodeA });
    expect(fixture.nodeA.addClass).toHaveBeenCalledWith("hovered");
    expect(fixture.style.setProperty).toHaveBeenCalledWith("cursor", "pointer");
    mouseOutHandler({ target: fixture.nodeA });
    expect(fixture.nodeA.removeClass).toHaveBeenCalledWith("hovered");
    expect(fixture.style.setProperty).toHaveBeenCalledWith("cursor", "default");

    rerender({ select: onSelectUpdated });
    tapHandler({ target: fixture.nodeA });
    expect(onSelectUpdated).toHaveBeenCalledWith("character-a");

    unmount();
    expect(fixture.cy.destroy).toHaveBeenCalledOnce();
  });

  it("applies selection, neighborhood dimming and search matches", () => {
    const fixture = createCytoscapeFixture();
    mockState.cytoscape.mockReturnValue(fixture.cy);

    renderHook(() =>
      useCytoscapeGraph({
        containerRef: { current: document.createElement("div") },
        graph,
        layoutMode: "network",
        matchingIdSet: new Set(["character-a"]),
        isSearchActive: true,
        selectedId: "character-a",
        onSelect: vi.fn()
      })
    );

    expect(fixture.cy.nodes).toHaveBeenCalledWith('[characterId = "character-a"]');
    expect(fixture.selected.addClass).toHaveBeenCalledWith("selected");
    expect(fixture.outside.addClass).toHaveBeenCalledWith("dimmed");
    expect(fixture.neighborhood.removeClass).toHaveBeenCalledWith("dimmed");
    expect(fixture.cy.animate).toHaveBeenCalledWith(
      { center: { eles: fixture.selected }, zoom: 1.05 },
      { duration: 220 }
    );
    expect(fixture.nodeA.addClass).toHaveBeenCalledWith("matched");
    expect(fixture.nodeB.addClass).toHaveBeenCalledWith("search-muted");
    expect(fixture.edge.addClass).toHaveBeenCalledWith("search-muted");
  });

  it("does not create Cytoscape without a mounted container", () => {
    renderHook(() =>
      useCytoscapeGraph({
        containerRef: { current: null },
        graph,
        layoutMode: "company",
        matchingIdSet: new Set(),
        isSearchActive: false,
        selectedId: null,
        onSelect: vi.fn()
      })
    );

    expect(mockState.cytoscape).not.toHaveBeenCalled();
  });
});
