import { useMemo, useRef } from "react";

import type { PublicGraph } from "./api";
import { useCytoscapeGraph } from "./graph/useCytoscapeGraph";

type GraphViewProps = {
  graph: PublicGraph;
  matchingIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function GraphView({ graph, matchingIds, selectedId, onSelect }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matchingIdSet = useMemo(() => new Set(matchingIds), [matchingIds]);

  useCytoscapeGraph({ containerRef, graph, matchingIdSet, selectedId, onSelect });

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
