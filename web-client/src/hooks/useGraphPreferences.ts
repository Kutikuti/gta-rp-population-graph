import { useEffect, useState } from "react";

import {
  type GraphPreferences,
  initialGraphPreferences,
  normalizeGraphPreferences
} from "../graph/graphPreferences";

const graphPreferencesStorageKey = "gta-rp-graph-preferences";

const readStoredGraphPreferences = (): GraphPreferences => {
  try {
    const stored = window.localStorage.getItem(graphPreferencesStorageKey);

    if (!stored) {
      return initialGraphPreferences;
    }

    return normalizeGraphPreferences(JSON.parse(stored));
  } catch {
    return initialGraphPreferences;
  }
};

export function useGraphPreferences() {
  const [preferences, setPreferences] = useState<GraphPreferences>(readStoredGraphPreferences);

  useEffect(() => {
    window.localStorage.setItem(graphPreferencesStorageKey, JSON.stringify(preferences));
  }, [preferences]);

  return [preferences, setPreferences] as const;
}
