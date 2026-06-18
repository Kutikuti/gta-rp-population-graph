import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AuthSession,
  type CharacterFilters,
  getAuthSession,
  getCharacter,
  getGoogleAuthUrl,
  getGraph,
  listCharacterMatches,
  listHistory,
  listTags,
  logout,
  type PublicCharacterDetail,
  type PublicGraph,
  type PublicHistoryEntry,
  type PublicTag
} from "./api";
import "./App.css";
import { AuthControls } from "./components/AuthControls";
import { CharacterSheet } from "./components/CharacterSheet";
import { FiltersPanel } from "./components/FiltersPanel";
import { GraphPanel } from "./components/GraphPanel";
import { EmptyBlock, LoadingBlock } from "./components/StateBlock";
import { initialFilters, isActiveFilters } from "./constants";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { usePersistentFilters } from "./hooks/usePersistentFilters";

function App() {
  const [filters, setFilters] = usePersistentFilters();
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [matchingIds, setMatchingIds] = useState<string[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [graph, setGraph] = useState<PublicGraph | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<PublicCharacterDetail | null>(null);
  const [history, setHistory] = useState<PublicHistoryEntry[]>([]);
  const [authFeedback, setAuthFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [authRedirectResult, setAuthRedirectResult] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
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
          setError("Impossible de charger les données publiques.");
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
    const url = new URL(window.location.href);
    const auth = url.searchParams.get("auth");
    const authError = url.searchParams.get("auth_error");

    if (!auth && !authError) {
      return;
    }

    setAuthRedirectResult(authError ?? auth);
    url.searchParams.delete("auth");
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadAuthSession = async () => {
      try {
        const session = await getAuthSession();

        if (!ignore) {
          setAuthSession(session);
        }
      } catch {
        if (!ignore) {
          setAuthSession({ authenticated: false });
        }
      } finally {
        if (!ignore) {
          setIsAuthLoading(false);
        }
      }
    };

    void loadAuthSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!authRedirectResult || isAuthLoading) {
      return;
    }

    if (authRedirectResult === "success") {
      setAuthFeedback(
        authSession?.authenticated
          ? { tone: "success", message: "Connexion établie." }
          : { tone: "error", message: "La session n'a pas pu être confirmée." }
      );
      setAuthRedirectResult(null);
      return;
    }

    const messages: Record<string, string> = {
      access_denied: "Connexion Google annulée.",
      banned: "Ce compte n'est pas autorisé à contribuer.",
      invalid_state: "La vérification de connexion a expiré. Réessaie.",
      oauth_disabled: "La connexion Google n'est pas disponible.",
      oauth_exchange_failed: "La connexion Google n'a pas pu aboutir."
    };

    setAuthFeedback({
      tone: "error",
      message: messages[authRedirectResult] ?? "La connexion Google n'a pas pu aboutir."
    });
    setAuthRedirectResult(null);
  }, [authRedirectResult, authSession, isAuthLoading]);

  useEffect(() => {
    const isDebouncedSearchActive = isActiveFilters(debouncedFilters);

    if (!isDebouncedSearchActive) {
      setMatchingIds([]);
      setSearchTotal(0);
      return undefined;
    }

    let ignore = false;

    const loadMatches = async () => {
      try {
        setError(null);
        const result = await listCharacterMatches(debouncedFilters);

        if (!ignore) {
          setMatchingIds(result.ids);
          setSearchTotal(result.total);
        }
      } catch {
        if (!ignore) {
          setError("La recherche n'a pas pu aboutir.");
        }
      }
    };

    void loadMatches();

    return () => {
      ignore = true;
    };
  }, [debouncedFilters]);

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
          setError("La fiche personnage n'a pas pu être chargée.");
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

  const isSearchActive = isActiveFilters(filters);
  const searchResultSummary = useMemo(() => {
    if (!isSearchActive) {
      return null;
    }

    if (searchTotal === 0) {
      return "Aucun personnage trouvé.";
    }

    return `${searchTotal} personnage${searchTotal > 1 ? "s" : ""} mis en évidence.`;
  }, [isSearchActive, searchTotal]);

  const closeDetails = useCallback(() => {
    setSelectedId(null);
    setSelectedCharacter(null);
    setHistory([]);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((currentId) => {
      if (id === currentId) {
        setSelectedCharacter(null);
        setHistory([]);
        return null;
      }

      return id;
    });
  }, []);

  const updateFilter = (key: keyof CharacterFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setIsSearchOpen(true);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthSession({ authenticated: false });
      setAuthFeedback({ tone: "success", message: "Déconnexion effectuée." });
    } catch {
      setError("La déconnexion n'a pas pu aboutir.");
    }
  };

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="workspace-title">
        <header className="topbar">
          <div className="topbar-content">
            <div className="topbar-copy">
              <p className="eyebrow">Annuaire RP public</p>
              <h1 id="workspace-title">GTA-RP Population Graph</h1>
              {authFeedback ? (
                <p className={`auth-feedback auth-feedback-${authFeedback.tone}`}>
                  {authFeedback.message}
                </p>
              ) : null}
            </div>
            <AuthControls
              isLoading={isAuthLoading}
              session={authSession}
              loginHref={getGoogleAuthUrl()}
              onLogout={handleLogout}
            />
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
                  resultSummary={searchResultSummary}
                  onChange={updateFilter}
                  onReset={resetFilters}
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
            isSearchActive={isSearchActive}
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
