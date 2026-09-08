import { useEffect, useState } from "react";

import type { CharacterFilters } from "../api";
import { initialFilters } from "../constants";

const filtersStorageKey = "gta-rp-public-filters";

const readStoredFilters = (): CharacterFilters => {
  try {
    const stored = window.localStorage.getItem(filtersStorageKey);

    if (!stored) {
      return initialFilters;
    }

    const previous = JSON.parse(stored) as Partial<CharacterFilters>;
    return {
      ...initialFilters,
      ...previous,
      q: previous.q || previous.streamer || "",
      streamer: "",
      verificationStatus: ""
    };
  } catch {
    return initialFilters;
  }
};

export function usePersistentFilters() {
  const [filters, setFilters] = useState<CharacterFilters>(readStoredFilters);

  useEffect(() => {
    window.localStorage.setItem(filtersStorageKey, JSON.stringify(filters));
  }, [filters]);

  return [filters, setFilters] as const;
}
