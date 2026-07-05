import { useMemo, useRef } from "react";

import type { PublicGraph } from "./api";
import type { GraphLayoutMode } from "./graph/graphLayout";
import { useCytoscapeGraph } from "./graph/useCytoscapeGraph";

type GraphViewProps = {
  graph: PublicGraph;
  layoutMode: GraphLayoutMode;
  matchingIds: string[];
  isSearchActive: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function GraphView({
  graph,
  layoutMode,
  matchingIds,
  isSearchActive,
  selectedId,
  onSelect
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matchingIdSet = useMemo(() => new Set(matchingIds), [matchingIds]);

  useCytoscapeGraph({
    containerRef,
    graph,
    layoutMode,
    matchingIdSet,
    isSearchActive,
    selectedId,
    onSelect
  });

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      role="img"
      aria-label="Graphe interactif des personnages"
    />
  );
}

export default GraphView;
