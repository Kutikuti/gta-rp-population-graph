import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CharacterFilters,
  getCharacter,
  getGraph,
  listCharacters,
  listHistory,
  listTags,
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  }, [filters]);

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

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const closeDetails = () => {
    setSelectedId(null);
    setSelectedCharacter(null);
    setHistory([]);
  };

  const updateFilter = (key: keyof CharacterFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setIsSearchOpen(true);
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
        </header>

        <div
          className={`app-grid ${isSearchOpen ? "has-search" : ""} ${selectedId ? "has-details" : ""}`}
        >
          <aside
            className={`filters-panel ${isSearchOpen ? "is-open" : "is-collapsed"}`}
            aria-label="Recherche et filtres"
          >
            {isSearchOpen ? (
              <>
                <button
                  type="button"
                  className="panel-icon-button panel-close-button"
                  aria-label="Replier la recherche"
                  onClick={() => {
                    setIsSearchOpen(false);
                  }}
                >
                  ×
                </button>
                <FiltersPanel
                  filters={filters}
                  tags={tags}
                  onChange={updateFilter}
                  onReset={resetFilters}
                />
                <ResultsList
                  characters={characters}
                  selectedId={selectedId}
                  isLoading={isListLoading}
                  total={total}
                  onSelect={handleSelect}
                />
              </>
            ) : (
              <button
                type="button"
                className="search-toggle"
                aria-label="Ouvrir la recherche"
                onClick={() => {
                  setIsSearchOpen(true);
                }}
              >
                <span aria-hidden="true" className="search-toggle-icon" />
              </button>
            )}
          </aside>

          <GraphPanel
            graph={graph}
            matchingIds={matchingIds}
            selectedId={selectedId}
            isLoading={isBootLoading}
            error={error}
            onSelect={handleSelect}
          />

          {selectedId ? (
            <aside className="details-panel" aria-label="Fiche personnage">
              <button
                type="button"
                className="panel-icon-button details-close-button"
                onClick={closeDetails}
              >
                Fermer
              </button>
              {isDetailLoading ? <LoadingBlock label="Chargement de la fiche..." /> : null}
              {!isDetailLoading && !selectedCharacter ? (
                <EmptyBlock label="Fiche indisponible." />
              ) : selectedCharacter ? (
                <CharacterSheet character={selectedCharacter} history={history} />
              ) : null}
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export { App };
