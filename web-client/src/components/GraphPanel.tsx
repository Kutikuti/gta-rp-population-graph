import { lazy, Suspense } from "react";

import type { CharacterFilters, PublicCharacterSummary, PublicGraph } from "../api";
import { isActiveFilters } from "../constants";
import { ErrorBlock, LoadingBlock } from "./StateBlock";

const GraphView = lazy(() => import("../GraphView"));

type GraphPanelProps = {
  graph: PublicGraph | null;
  matchingIds: string[];
  selectedId: string | null;
  selectedSummary: PublicCharacterSummary | null;
  filters: CharacterFilters;
  isLoading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
};

export function GraphPanel({
  graph,
  matchingIds,
  selectedId,
  selectedSummary,
  filters,
  isLoading,
  error,
  onSelect
}: GraphPanelProps) {
  return (
    <section className="graph-panel" aria-label="Graphe des personnages">
      <div className="graph-toolbar">
        <div>
          <h2>Graphe narratif</h2>
          <p>{selectedSummary ? `Selection : ${selectedSummary.fullName}` : "Selectionnez un noeud"}</p>
        </div>
        <span className="status-badge">{isActiveFilters(filters) ? "Filtre actif" : "Vue complete"}</span>
      </div>

      {error ? (
        <ErrorBlock message={error} />
      ) : isLoading ? (
        <LoadingBlock label="Chargement du graphe..." />
      ) : !graph ? (
        <ErrorBlock message="Le graphe public est indisponible." />
      ) : (
        <Suspense fallback={<LoadingBlock label="Initialisation du graphe..." />}>
          <GraphView graph={graph} matchingIds={matchingIds} selectedId={selectedId} onSelect={onSelect} />
        </Suspense>
      )}
    </section>
  );
}
