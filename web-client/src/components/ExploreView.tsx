import type {
  CharacterFilters,
  PublicCharacterDetail,
  PublicGraph,
  PublicHistoryEntry,
  PublicTag
} from "../api";
import type { GraphPreferences } from "../graph/graphPreferences";
import { DetailsSidebar } from "./DetailsSidebar";
import { GraphPanel } from "./GraphPanel";
import { SearchSidebar } from "./SearchSidebar";

type ExploreViewProps = {
  canEditDirectly: boolean;
  canSuggestCreation: boolean;
  creationActionLabel: string;
  error: string | null;
  filters: CharacterFilters;
  graph: PublicGraph | null;
  graphPreferences: GraphPreferences;
  history: PublicHistoryEntry[];
  isBootLoading: boolean;
  isDetailLoading: boolean;
  isGraphPreferencesOpen: boolean;
  isSearchActive: boolean;
  isSearchOpen: boolean;
  matchingIds: string[];
  resultSummary: string | null;
  selectedCharacter: PublicCharacterDetail | null;
  selectedId: string | null;
  tags: PublicTag[];
  onCloseDetails: () => void;
  onContribute: () => void;
  onGraphPreferencesChange: (preferences: GraphPreferences) => void;
  onInfoOpen: () => void;
  onPreferencesClose: () => void;
  onPreferencesOpen: () => void;
  onResetFilters: () => void;
  onSearchChange: (key: keyof CharacterFilters, value: string) => void;
  onSearchClose: () => void;
  onSearchOpen: () => void;
  onSelect: (id: string) => void;
  onShare: () => void;
  onSuggestCreation: () => void;
};

export function ExploreView({
  canEditDirectly,
  canSuggestCreation,
  creationActionLabel,
  error,
  filters,
  graph,
  graphPreferences,
  history,
  isBootLoading,
  isDetailLoading,
  isGraphPreferencesOpen,
  isSearchActive,
  isSearchOpen,
  matchingIds,
  resultSummary,
  selectedCharacter,
  selectedId,
  tags,
  onCloseDetails,
  onContribute,
  onGraphPreferencesChange,
  onInfoOpen,
  onPreferencesClose,
  onPreferencesOpen,
  onResetFilters,
  onSearchChange,
  onSearchClose,
  onSearchOpen,
  onSelect,
  onShare,
  onSuggestCreation
}: ExploreViewProps) {
  return (
    <div
      className={`app-grid ${isSearchOpen ? "has-search" : ""} ${selectedId ? "has-details" : ""}`}
    >
      <SearchSidebar
        canSuggestCreation={canSuggestCreation}
        creationActionLabel={creationActionLabel}
        filters={filters}
        isOpen={isSearchOpen}
        resultSummary={resultSummary}
        tags={tags}
        onChange={onSearchChange}
        onClose={onSearchClose}
        onOpen={onSearchOpen}
        onReset={onResetFilters}
        onSuggestCreation={onSuggestCreation}
      />

      <GraphPanel
        graph={graph}
        matchingIds={matchingIds}
        isSearchActive={isSearchActive}
        selectedId={selectedId}
        isLoading={isBootLoading}
        error={error}
        graphPreferences={graphPreferences}
        isPreferencesOpen={isGraphPreferencesOpen}
        onGraphPreferencesChange={onGraphPreferencesChange}
        onInfoOpen={onInfoOpen}
        onPreferencesClose={onPreferencesClose}
        onPreferencesOpen={onPreferencesOpen}
        onSelect={onSelect}
      />

      {selectedId ? (
        <DetailsSidebar
          canEditDirectly={canEditDirectly}
          character={selectedCharacter}
          history={history}
          isLoading={isDetailLoading}
          onClose={onCloseDetails}
          onContribute={onContribute}
          onShare={onShare}
        />
      ) : null}
    </div>
  );
}
