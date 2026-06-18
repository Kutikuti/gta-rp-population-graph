import { useEffect, useState } from "react";

import { getGraph, listTags, type PublicGraph, type PublicTag } from "../api";

export function usePublicGraphData(onError: (message: string) => void) {
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [graph, setGraph] = useState<PublicGraph | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        const [tagsResult, graphResult] = await Promise.all([listTags(), getGraph()]);

        if (!ignore) {
          setTags(tagsResult);
          setGraph(graphResult);
        }
      } catch {
        if (!ignore) {
          onError("Impossible de charger les données publiques.");
        }
      } finally {
        if (!ignore) {
          setIsBootLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, [onError]);

  return {
    graph,
    isBootLoading,
    tags
  };
}
