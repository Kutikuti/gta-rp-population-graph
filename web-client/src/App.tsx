import { useCallback, useEffect, useState } from "react";

import type { CharacterCreationContext, CharacterFilters } from "./api";
import "./App.css";
import { AdminView } from "./components/AdminView";
import { AppHeader } from "./components/AppHeader";
import { ContributionView } from "./components/ContributionView";
import { DetailsSidebar } from "./components/DetailsSidebar";
import { GraphPanel } from "./components/GraphPanel";
import { ModerationView } from "./components/ModerationView";
import { ProfileView } from "./components/ProfileView";
import { SearchSidebar } from "./components/SearchSidebar";
import { initialFilters } from "./constants";
import { useAuthSession } from "./hooks/useAuthSession";
import { useCharacterDetails } from "./hooks/useCharacterDetails";
import { usePersistentFilters } from "./hooks/usePersistentFilters";
import { usePublicGraphData } from "./hooks/usePublicGraphData";
import { useSearchMatches } from "./hooks/useSearchMatches";

const readInitialCharacterId = () => new URL(window.location.href).searchParams.get("character");

function App() {
  const [filters, setFilters] = usePersistentFilters();
  const [selectedId, setSelectedId] = useState<string | null>(readInitialCharacterId);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationContext, setCreationContext] = useState<CharacterCreationContext | null>(null);
  const [toast, setToast] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [activeView, setActiveView] = useState<
    "explore" | "contribution" | "moderation" | "administration" | "profile"
  >("explore");

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const { graph, isBootLoading, refreshPublicGraphData, tags } = usePublicGraphData(handleError);
  const { authFeedback, authSession, handleDisplayNameUpdate, handleLogout, isAuthLoading } =
    useAuthSession(handleError);
  const { isSearchActive, matchingIds, searchResultSummary, searchTotal } = useSearchMatches(
    filters,
    handleError
  );
  const { history, isDetailLoading, refreshCharacterDetails, selectedCharacter } =
    useCharacterDetails(selectedId, handleError);
  const canEditDirectly =
    authSession?.authenticated &&
    (authSession.user.role.name === "moderator" || authSession.user.role.name === "administrator");

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    if (authFeedback?.tone === "error") {
      setToast(authFeedback);
    }
  }, [authFeedback]);

  useEffect(() => {
    if (authSession?.authenticated && authSession.user.mustChooseDisplayName) {
      setCreationContext(null);
      setActiveView("profile");
    }
  }, [authSession]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (selectedId) {
      url.searchParams.set("character", selectedId);
    } else {
      url.searchParams.delete("character");
    }

    window.history.replaceState({}, "", url.toString());
  }, [selectedId]);

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

  const openCharacterCreation = () => {
    setSelectedId(null);
    setCreationContext({
      ...filters,
      matchTotal: searchTotal
    });
    setActiveView("contribution");
  };

  const handleContributionSubmitted = (message: string, closeContribution: boolean) => {
    if (message) {
      setToast({ tone: "success", message });
    }

    if (closeContribution) {
      setCreationContext(null);
      setActiveView("explore");
    }
  };

  const refreshAfterModerationChange = useCallback(async () => {
    try {
      await Promise.all([refreshPublicGraphData(), refreshCharacterDetails()]);
    } catch {
      handleError("Les données publiques n'ont pas pu être rafraîchies.");
    }
  }, [handleError, refreshCharacterDetails, refreshPublicGraphData]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="workspace-title">
        <AppHeader
          activeView={activeView}
          authFeedback={authFeedback}
          authSession={authSession}
          isAuthLoading={isAuthLoading}
          onAdministration={() => {
            setActiveView("administration");
          }}
          onExplore={() => {
            setCreationContext(null);
            setActiveView("explore");
          }}
          onLogout={handleLogout}
          onModeration={() => {
            setActiveView("moderation");
          }}
          onProfile={() => {
            setActiveView("profile");
          }}
        />

        {activeView === "explore" ? (
          <div
            className={`app-grid ${isSearchOpen ? "has-search" : ""} ${selectedId ? "has-details" : ""}`}
          >
            <SearchSidebar
              canSuggestCreation={
                Boolean(authSession?.authenticated) && isSearchActive && searchTotal === 0
              }
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
              onSuggestCreation={openCharacterCreation}
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
                canEditDirectly={Boolean(canEditDirectly)}
                character={selectedCharacter}
                history={history}
                isLoading={isDetailLoading}
                onClose={closeDetails}
                onContribute={() => {
                  setCreationContext(null);
                  setActiveView("contribution");
                }}
                onShare={async () => {
                  if (!selectedId) {
                    return;
                  }

                  const url = new URL(window.location.href);
                  url.searchParams.set("character", selectedId);

                  try {
                    await navigator.clipboard.writeText(url.toString());
                    setToast({ tone: "success", message: "Lien de la fiche copié." });
                  } catch {
                    setError("Le lien n'a pas pu être copié.");
                  }
                }}
              />
            ) : null}
          </div>
        ) : null}

        {activeView === "contribution" ? (
          <ContributionView
            character={selectedCharacter}
            creationContext={creationContext}
            session={authSession}
            onDataChanged={refreshAfterModerationChange}
            onError={handleError}
            onSubmitted={handleContributionSubmitted}
          />
        ) : null}

        {activeView === "moderation" ? (
          <ModerationView
            session={authSession}
            onDataChanged={refreshAfterModerationChange}
            onError={handleError}
          />
        ) : null}
        {activeView === "administration" ? (
          <AdminView session={authSession} onError={handleError} />
        ) : null}
        {activeView === "profile" ? (
          <ProfileView
            session={authSession}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onError={handleError}
          />
        ) : null}
        {toast ? (
          <div className={`app-toast app-toast-${toast.tone}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export { App };
