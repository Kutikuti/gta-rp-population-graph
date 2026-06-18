import type { CharacterFilters, PublicTag } from "../api";
import { FiltersPanel } from "./FiltersPanel";

type SearchSidebarProps = {
  filters: CharacterFilters;
  isOpen: boolean;
  resultSummary: string | null;
  tags: PublicTag[];
  onChange: (key: keyof CharacterFilters, value: string) => void;
  onClose: () => void;
  onOpen: () => void;
  onReset: () => void;
};

export function SearchSidebar({
  filters,
  isOpen,
  resultSummary,
  tags,
  onChange,
  onClose,
  onOpen,
  onReset
}: SearchSidebarProps) {
  return (
    <aside
      className={`filters-panel ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Recherche et filtres"
    >
      {isOpen ? (
        <>
          <button
            type="button"
            className="panel-icon-button panel-close-button"
            aria-label="Replier la recherche"
            onClick={onClose}
          >
            ×
          </button>
          <FiltersPanel
            filters={filters}
            tags={tags}
            resultSummary={resultSummary}
            onChange={onChange}
            onReset={onReset}
          />
        </>
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
