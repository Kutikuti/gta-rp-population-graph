import cytoscape, { type Core, type EventObject, type NodeSingular } from "cytoscape";
import { useEffect, useRef } from "react";

import type { PublicGraph } from "../api";
import { cytoscapeStyles } from "./cytoscapeStyles";
import { toCytoscapeElements } from "./graphElements";
import { type GraphLayoutMode, graphLayoutOptions } from "./graphLayout";

const relationshipRefinementLayout: cytoscape.CoseLayoutOptions = {
  name: "cose",
  animate: false,
  fit: false,
  randomize: false,
  componentSpacing: 120,
  nodeRepulsion: 5000,
  idealEdgeLength: 110,
  gravity: 0.05,
  numIter: 250
};

type UseCytoscapeGraphParams = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  graph: PublicGraph;
  layoutMode: GraphLayoutMode;
  matchingIdSet: Set<string>;
  isSearchActive: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function useCytoscapeGraph({
  containerRef,
  graph,
  layoutMode,
  matchingIdSet,
  isSearchActive,
  selectedId,
  onSelect
}: UseCytoscapeGraphParams) {
  const cytoscapeRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: toCytoscapeElements(graph),
      minZoom: 0.08,
      maxZoom: 2.2,
      wheelSensitivity: 1.35,
      style: cytoscapeStyles,
      layout: graphLayoutOptions(graph, layoutMode, {
        width: containerRef.current.clientWidth || window.innerWidth,
        height: containerRef.current.clientHeight || window.innerHeight
      })
    });

    if (layoutMode !== "network" && graph.edges.length > 0) {
      const relatedNodes = cy.nodes().filter((node) => node.connectedEdges().length > 0);
      const relatedElements = relatedNodes.union(relatedNodes.connectedEdges());

      relatedElements.layout(relationshipRefinementLayout).run();
      cy.fit(cy.elements(), 48);
    }

    const handleNodeTap = (event: EventObject) => {
      const node = event.target as NodeSingular;
      const id = node.data("characterId") as string;
      onSelectRef.current(id);
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
  }, [containerRef, graph, layoutMode]);

  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().removeClass("selected dimmed").removeStyle("border-width");
    cy.edges().removeClass("dimmed");

    if (selectedId) {
      const selected = cy.nodes(`[characterId = "${selectedId}"]`);
      selected.addClass("selected");
      cy.elements().not(selected.closedNeighborhood()).addClass("dimmed");
      selected.closedNeighborhood().removeClass("dimmed");
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      cy.animate(
        { center: { eles: selected }, zoom: Math.max(cy.zoom(), 1.05) },
        { duration: prefersReducedMotion ? 0 : 220 }
      );
    }
  }, [selectedId]);

  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().removeClass("matched search-muted");
    cy.edges().removeClass("search-muted");

    if (!isSearchActive) {
      return;
    }

    cy.nodes().forEach((node) => {
      const isMatched = matchingIdSet.has(node.data("characterId") as string);
      const isSelected = node.data("characterId") === selectedId;

      if (isMatched) {
        node.addClass("matched");
      } else if (!isSelected) {
        node.addClass("search-muted");
      }
    });

    cy.edges().forEach((edge) => {
      const sourceId = edge.data("source") as string;
      const targetId = edge.data("target") as string;

      if (!(matchingIdSet.has(sourceId) && matchingIdSet.has(targetId))) {
        edge.addClass("search-muted");
      }
    });
  }, [matchingIdSet, isSearchActive, selectedId]);
}
