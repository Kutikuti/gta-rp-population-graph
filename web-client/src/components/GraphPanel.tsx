import { lazy, Suspense } from "react";

import type { PublicGraph } from "../api";
import { ErrorBlock, LoadingBlock } from "./StateBlock";

const GraphView = lazy(() => import("../GraphView"));

type GraphPanelProps = {
  graph: PublicGraph | null;
  matchingIds: string[];
  isSearchActive: boolean;
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
};

export function GraphPanel({
  graph,
  matchingIds,
  isSearchActive,
  selectedId,
  isLoading,
  error,
  onSelect
}: GraphPanelProps) {
  return (
    <section className="graph-panel" aria-label="Graphe des personnages">
      {error ? (
        <ErrorBlock message={error} />
      ) : isLoading ? (
        <LoadingBlock label="Chargement du graphe..." />
      ) : !graph ? (
        <ErrorBlock message="Le graphe public est indisponible." />
      ) : (
        <Suspense fallback={<LoadingBlock label="Initialisation du graphe..." />}>
          <GraphView
            graph={graph}
            matchingIds={matchingIds}
            isSearchActive={isSearchActive}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </Suspense>
      )}
    </section>
  );
}
