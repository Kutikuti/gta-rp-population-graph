import { useEffect, useMemo, useState } from "react";

import { type CharacterFilters, listCharacterMatches } from "../api";
import { isActiveFilters } from "../constants";
import { useDebouncedValue } from "./useDebouncedValue";

export function useSearchMatches(filters: CharacterFilters, onError: (message: string) => void) {
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [matchingIds, setMatchingIds] = useState<string[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const isSearchActive = isActiveFilters(filters);

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
        const result = await listCharacterMatches(debouncedFilters);

        if (!ignore) {
          setMatchingIds(result.ids);
          setSearchTotal(result.total);
        }
      } catch {
        if (!ignore) {
          onError("La recherche n'a pas pu aboutir.");
        }
      }
    };

    void loadMatches();

    return () => {
      ignore = true;
    };
  }, [debouncedFilters, onError]);

  const searchResultSummary = useMemo(() => {
    if (!isSearchActive) {
      return null;
    }

    if (searchTotal === 0) {
      return "Aucun personnage trouvé.";
    }

    return `${searchTotal} personnage${searchTotal > 1 ? "s" : ""} mis en évidence.`;
  }, [isSearchActive, searchTotal]);

  return {
    isSearchActive,
    matchingIds,
    searchResultSummary,
    searchTotal
  };
}
