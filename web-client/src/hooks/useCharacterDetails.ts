import { useCallback, useEffect, useState } from "react";

import {
  getCharacter,
  listHistory,
  type PublicCharacterDetail,
  type PublicHistoryEntry
} from "../api";

export function useCharacterDetails(selectedId: string | null, onError: (message: string) => void) {
  const [selectedCharacter, setSelectedCharacter] = useState<PublicCharacterDetail | null>(null);
  const [history, setHistory] = useState<PublicHistoryEntry[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const refreshCharacterDetails = useCallback(async () => {
    if (!selectedId) {
      return;
    }

    const [detailResult, historyResult] = await Promise.all([
      getCharacter(selectedId),
      listHistory(selectedId)
    ]);
    setSelectedCharacter(detailResult);
    setHistory(historyResult);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCharacter(null);
      setHistory([]);
      setIsDetailLoading(false);
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
          onError("La fiche personnage n'a pas pu être chargée.");
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
  }, [onError, selectedId]);

  return {
    history,
    isDetailLoading,
    refreshCharacterDetails,
    selectedCharacter
  };
}
