import cytoscape, { type Core, type EventObject, type NodeSingular } from "cytoscape";
import { useEffect, useRef } from "react";

import type { PublicGraph } from "../api";
import { cytoscapeStyles } from "./cytoscapeStyles";
import { toCytoscapeElements } from "./graphElements";

type UseCytoscapeGraphParams = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  graph: PublicGraph;
  matchingIdSet: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function useCytoscapeGraph({
  containerRef,
  graph,
  matchingIdSet,
  selectedId,
  onSelect
}: UseCytoscapeGraphParams) {
  const cytoscapeRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: toCytoscapeElements(graph, matchingIdSet),
      minZoom: 0.35,
      maxZoom: 2.2,
      style: cytoscapeStyles,
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 48,
        nodeRepulsion: 6800,
        idealEdgeLength: 150
      }
    });

    const handleNodeTap = (event: EventObject) => {
      const node = event.target as NodeSingular;
      const id = node.data("characterId") as string;
      onSelect(id);
    };

    const handleNodeMouseOver = (event: EventObject) => {
      const node = event.target as NodeSingular;
      node.addClass("hovered");
      cy.container()?.style.setProperty("cursor", "pointer");
    };

    const handleNodeMouseOut = (event: EventObject) => {
      const node = event.target as NodeSingular;
      node.removeClass("hovered");
      cy.container()?.style.setProperty("cursor", "default");
    };

    cy.on("tap", "node", handleNodeTap);
    cy.on("mouseover", "node", handleNodeMouseOver);
    cy.on("mouseout", "node", handleNodeMouseOut);
    cytoscapeRef.current = cy;

    return () => {
      cy.destroy();
      cytoscapeRef.current = null;
    };
  }, [containerRef, graph, matchingIdSet, onSelect]);

  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().removeClass("selected dimmed");
    cy.edges().removeClass("dimmed");

    if (selectedId) {
      const selected = cy.nodes(`[characterId = "${selectedId}"]`);
      selected.addClass("selected");
      cy.elements().not(selected.closedNeighborhood()).addClass("dimmed");
      selected.closedNeighborhood().removeClass("dimmed");
      selected.animate({ style: { "border-width": 4 } }, { duration: 120 });
      cy.animate({ center: { eles: selected }, zoom: Math.max(cy.zoom(), 1.05) }, { duration: 220 });
    }
  }, [selectedId]);

  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().forEach((node) => {
      if (matchingIdSet.has(node.data("characterId") as string)) {
        node.addClass("matched");
      } else {
        node.removeClass("matched");
      }
    });
  }, [matchingIdSet]);
}
