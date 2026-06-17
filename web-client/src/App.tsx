import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCharacter,
  getGraph,
  listCharacters,
  listHistory,
  listTags,
  type CharacterFilters,
  type PublicCharacterDetail,
  type PublicCharacterSummary,
  type PublicGraph,
  type PublicHistoryEntry,
  type PublicTag
} from "./api";
import "./App.css";
import { CharacterSheet } from "./components/CharacterSheet";
import { FiltersPanel } from "./components/FiltersPanel";
import { GraphPanel } from "./components/GraphPanel";
import { ResultsList } from "./components/ResultsList";
import { EmptyBlock, LoadingBlock } from "./components/StateBlock";
import { initialFilters } from "./constants";
import { usePersistentFilters } from "./hooks/usePersistentFilters";

function App() {
  const [filters, setFilters] = usePersistentFilters();
  const [characters, setCharacters] = useState<PublicCharacterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [graph, setGraph] = useState<PublicGraph | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<PublicCharacterDetail | null>(null);
  const [history, setHistory] = useState<PublicHistoryEntry[]>([]);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        setError(null);
        const [tagsResult, graphResult] = await Promise.all([listTags(), getGraph()]);

        if (!ignore) {
          setTags(tagsResult);
          setGraph(graphResult);
        }
      } catch {
        if (!ignore) {
          setError("Impossible de charger les donnees publiques.");
        }
      } finally {
        if (!ignore) {
          setIsBootLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadCharacters = async () => {
      try {
        setIsListLoading(true);
        setError(null);
        const result = await listCharacters(filters);

        if (!ignore) {
          setCharacters(result.items);
          setTotal(result.total);

          if (!selectedId && result.items[0]) {
            setSelectedId(result.items[0].id);
          }
        }
      } catch {
        if (!ignore) {
          setError("La recherche n'a pas pu aboutir.");
        }
      } finally {
        if (!ignore) {
          setIsListLoading(false);
        }
      }
    };

    void loadCharacters();

    return () => {
      ignore = true;
    };
  }, [filters, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return undefined;
    }

    let ignore = false;

    const loadDetail = async () => {
      try {
        setIsDetailLoading(true);
        const [detailResult, historyResult] = await Promise.all([
          getCharacter(selectedId),
          listHistory(selectedId)
        ]);

        if (!ignore) {
          setSelectedCharacter(detailResult);
          setHistory(historyResult);
        }
      } catch {
        if (!ignore) {
          setSelectedCharacter(null);
          setHistory([]);
          setError("La fiche personnage n'a pas pu etre chargee.");
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  const matchingIds = useMemo(() => characters.map((character) => character.id), [characters]);
  const selectedSummary = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? null,
    [characters, selectedId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const updateFilter = (key: keyof CharacterFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="workspace-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Annuaire RP public</p>
            <h1 id="workspace-title">GTA-RP Population Graph</h1>
          </div>
          <div className="topbar-stats" aria-label="Synthese des donnees">
            <span>{total} personnages</span>
            <span>{tags.length} tags</span>
            <span>{graph?.edges.length ?? 0} liens</span>
          </div>
        </header>

        <div className="app-grid">
          <aside className="filters-panel" aria-label="Recherche et filtres">
            <FiltersPanel filters={filters} tags={tags} onChange={updateFilter} onReset={resetFilters} />
            <ResultsList
              characters={characters}
              selectedId={selectedId}
              isLoading={isListLoading}
              onSelect={handleSelect}
            />
          </aside>

          <GraphPanel
            graph={graph}
            matchingIds={matchingIds}
            selectedId={selectedId}
            selectedSummary={selectedSummary}
            filters={filters}
            isLoading={isBootLoading}
            error={error}
            onSelect={handleSelect}
          />

          <aside className="details-panel" aria-label="Fiche personnage">
            {isDetailLoading ? <LoadingBlock label="Chargement de la fiche..." /> : null}
            {!isDetailLoading && !selectedCharacter ? (
              <EmptyBlock label="Aucune fiche selectionnee." />
            ) : selectedCharacter ? (
              <CharacterSheet character={selectedCharacter} history={history} />
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

export { App };
