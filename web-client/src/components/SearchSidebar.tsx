import type { CharacterFilters, PublicTag } from "../api";
import { FiltersPanel } from "./FiltersPanel";

type SearchSidebarProps = {
  canSuggestCreation: boolean;
  filters: CharacterFilters;
  isOpen: boolean;
  resultSummary: string | null;
  tags: PublicTag[];
  onChange: (key: keyof CharacterFilters, value: string) => void;
  onClose: () => void;
  onOpen: () => void;
  onReset: () => void;
  onSuggestCreation: () => void;
};

export function SearchSidebar({
  canSuggestCreation,
  filters,
  isOpen,
  resultSummary,
  tags,
  onChange,
  onClose,
  onOpen,
  onReset,
  onSuggestCreation
}: SearchSidebarProps) {
  return (
    <aside
      className={`filters-panel ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Recherche et filtres"
    >
      {isOpen ? (
        <FiltersPanel
          canSuggestCreation={canSuggestCreation}
          filters={filters}
          onClose={onClose}
          tags={tags}
          resultSummary={resultSummary}
          onChange={onChange}
          onReset={onReset}
          onSuggestCreation={onSuggestCreation}
        />
      ) : (
        <button
          type="button"
          className="search-toggle"
          aria-label="Ouvrir la recherche"
          onClick={onOpen}
        >
          <span aria-hidden="true" className="search-toggle-icon" />
        </button>
      )}
    </aside>
  );
}
