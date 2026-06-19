import { useCallback, useState } from "react";

import type { CharacterFilters } from "./api";
import "./App.css";
import { AppHeader } from "./components/AppHeader";
import { ContributionView } from "./components/ContributionView";
import { DetailsSidebar } from "./components/DetailsSidebar";
import { GraphPanel } from "./components/GraphPanel";
import { ModerationView } from "./components/ModerationView";
import { SearchSidebar } from "./components/SearchSidebar";
import { initialFilters } from "./constants";
import { useAuthSession } from "./hooks/useAuthSession";
import { useCharacterDetails } from "./hooks/useCharacterDetails";
import { usePersistentFilters } from "./hooks/usePersistentFilters";
import { usePublicGraphData } from "./hooks/usePublicGraphData";
import { useSearchMatches } from "./hooks/useSearchMatches";

function App() {
  const [filters, setFilters] = usePersistentFilters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"explore" | "contribution" | "moderation">(
    "explore"
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const { graph, isBootLoading, tags } = usePublicGraphData(handleError);
  const { authFeedback, authSession, handleLogout, isAuthLoading } = useAuthSession(handleError);
  const { isSearchActive, matchingIds, searchResultSummary } = useSearchMatches(
    filters,
    handleError
  );
  const { history, isDetailLoading, selectedCharacter } = useCharacterDetails(
    selectedId,
    handleError
  );

  const closeDetails = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((currentId) => (id === currentId ? null : id));
  }, []);

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
        <AppHeader
          activeView={activeView}
          authFeedback={authFeedback}
          authSession={authSession}
          isAuthLoading={isAuthLoading}
          onExplore={() => {
            setActiveView("explore");
          }}
          onLogout={handleLogout}
          onModeration={() => {
            setActiveView("moderation");
          }}
        />

        {activeView === "explore" ? (
          <div
            className={`app-grid ${isSearchOpen ? "has-search" : ""} ${selectedId ? "has-details" : ""}`}
          >
            <SearchSidebar
              filters={filters}
              isOpen={isSearchOpen}
              resultSummary={searchResultSummary}
              tags={tags}
              onChange={updateFilter}
              onClose={() => {
                setIsSearchOpen(false);
              }}
              onOpen={() => {
                setIsSearchOpen(true);
              }}
              onReset={resetFilters}
            />

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
              <DetailsSidebar
                character={selectedCharacter}
                history={history}
                isLoading={isDetailLoading}
                onClose={closeDetails}
                onContribute={() => {
                  setActiveView("contribution");
                }}
              />
            ) : null}
          </div>
        ) : null}

        {activeView === "contribution" ? (
          <ContributionView
            character={selectedCharacter}
            session={authSession}
            onBack={() => {
              setActiveView("explore");
            }}
            onError={handleError}
          />
        ) : null}

        {activeView === "moderation" ? (
          <ModerationView
            session={authSession}
            onBack={() => {
              setActiveView("explore");
            }}
            onError={handleError}
          />
        ) : null}
      </section>
    </main>
  );
}

export { App };
