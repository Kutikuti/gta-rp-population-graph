import { lazy, Suspense } from "react";

import type { PublicGraph } from "../api";
import type { GraphPreferences } from "../graph/graphPreferences";
import { GraphPreferencesPanel } from "./GraphPreferencesPanel";
import { ErrorBlock, LoadingBlock } from "./StateBlock";

const GraphView = lazy(() => import("../GraphView"));

type GraphPanelProps = {
  graph: PublicGraph | null;
  matchingIds: string[];
  isSearchActive: boolean;
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  graphPreferences: GraphPreferences;
  isPreferencesOpen: boolean;
  onGraphPreferencesChange: (preferences: GraphPreferences) => void;
  onInfoOpen: () => void;
  onPreferencesClose: () => void;
  onPreferencesOpen: () => void;
  onSelect: (id: string) => void;
};

export function GraphPanel({
  graph,
  matchingIds,
  isSearchActive,
  selectedId,
  isLoading,
  error,
  graphPreferences,
  isPreferencesOpen,
  onGraphPreferencesChange,
  onInfoOpen,
  onPreferencesClose,
  onPreferencesOpen,
  onSelect
}: GraphPanelProps) {
  return (
    <section className="graph-panel" aria-label="Graphe des personnages">
      <GraphPreferencesPanel
        isOpen={isPreferencesOpen}
        preferences={graphPreferences}
        onChange={onGraphPreferencesChange}
        onClose={onPreferencesClose}
        onOpen={onPreferencesOpen}
      />
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
            layoutMode={graphPreferences.layoutMode}
            matchingIds={matchingIds}
            isSearchActive={isSearchActive}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </Suspense>
      )}
      <button
        type="button"
        className="graph-help-button"
        aria-label="Informations du projet"
        onClick={onInfoOpen}
      >
        ?
      </button>
    </section>
  );
}
