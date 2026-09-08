import { useEffect, useRef } from "react";

import type { CharacterFilters, PublicTag } from "../api";
import { FiltersPanel } from "./FiltersPanel";

type SearchSidebarProps = {
  canSuggestCreation: boolean;
  creationActionLabel: string;
  filters: CharacterFilters;
  companies: string[];
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
  creationActionLabel,
  filters,
  companies,
  isOpen,
  resultSummary,
  tags,
  onChange,
  onClose,
  onOpen,
  onReset,
  onSuggestCreation
}: SearchSidebarProps) {
  const wasOpen = useRef(isOpen);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    (isOpen ? closeButtonRef : openButtonRef).current?.focus();
  }, [isOpen]);

  return (
    <aside
      className={`filters-panel ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Recherche et filtres"
    >
      {isOpen ? (
        <FiltersPanel
          canSuggestCreation={canSuggestCreation}
          creationActionLabel={creationActionLabel}
          companies={companies}
          closeButtonRef={closeButtonRef}
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
          ref={openButtonRef}
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
