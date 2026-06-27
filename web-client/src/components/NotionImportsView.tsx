import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportEntry,
  type AuthSession,
  applyAdminNotionImportEntry,
  getAdminNotionImportDetail,
  importAdminNotionEntryPhoto,
  listAdminNotionImports
} from "../api";
import { NotionImportDetailPanel } from "./NotionImportDetailPanel";
import { NotionImportsBatchList } from "./NotionImportsBatchList";
import { NotionImportsTable } from "./NotionImportsTable";
import {
  type NotionImportAppliedFilter,
  notionImportApplyErrorMessage,
  notionImportPhotoErrorMessage
} from "./notion-imports-shared";

type NotionImportsViewProps = {
  session: AuthSession | null;
  onDataChanged: () => Promise<void>;
  onError: (message: string) => void;
};

export function NotionImportsView({ session, onDataChanged, onError }: NotionImportsViewProps) {
  const [batches, setBatches] = useState<AdminNotionImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminNotionImportDetail | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminNotionImportEntry["status"] | "all">("all");
  const [appliedFilter, setAppliedFilter] = useState<NotionImportAppliedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isImportingPhoto, setIsImportingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canAdmin = session?.authenticated && session.user.role.name === "administrator";

  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextBatches = await listAdminNotionImports();
      setBatches(nextBatches);
      setSelectedBatchId((current) => current ?? nextBatches[0]?.id ?? null);
    } catch {
      onError("Les imports Notion n'ont pas pu être chargés.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (canAdmin) {
      void loadBatches();
    }
  }, [canAdmin, loadBatches]);

  useEffect(() => {
    if (!selectedBatchId || !canAdmin) {
      return;
    }

    setIsLoading(true);
    void getAdminNotionImportDetail(selectedBatchId)
      .then((nextDetail) => {
        setDetail(nextDetail);
        setSelectedPageId((current) => current ?? nextDetail.entries[0]?.pageId ?? null);
      })
      .catch(() => {
        onError("Le détail de l'import Notion n'a pas pu être chargé.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [canAdmin, onError, selectedBatchId]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("fr");

    return [...(detail?.entries ?? [])]
      .filter((entry) => statusFilter === "all" || entry.status === statusFilter)
      .filter((entry) => {
        if (appliedFilter === "all") {
          return true;
        }

        return appliedFilter === "applied"
          ? Boolean(entry.appliedCharacterId)
          : !entry.appliedCharacterId;
      })
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }

        return entry.fullName.toLocaleLowerCase("fr").includes(normalizedQuery);
      })
      .sort((left, right) => {
        const nameComparison = left.fullName.localeCompare(right.fullName, "fr");

        if (nameComparison !== 0) {
          return nameComparison;
        }

        return left.pageId.localeCompare(right.pageId, "fr");
      });
  }, [appliedFilter, detail, searchQuery, statusFilter]);

  const selectedEntry = useMemo(
    () => detail?.entries.find((entry) => entry.pageId === selectedPageId) ?? null,
    [detail, selectedPageId]
  );

  const refreshSelectedBatch = useCallback(async () => {
    if (!selectedBatchId) {
      return;
    }

    const nextDetail = await getAdminNotionImportDetail(selectedBatchId);
    setDetail(nextDetail);
    setSelectedPageId((current) => current ?? nextDetail.entries[0]?.pageId ?? null);
  }, [selectedBatchId]);

  const handleApplyEntry = useCallback(async () => {
    if (!selectedBatchId || !selectedEntry) {
      return;
    }

    setIsApplying(true);
    setFeedback(null);

    try {
      const result = await applyAdminNotionImportEntry(selectedBatchId, selectedEntry.pageId);
      await Promise.all([loadBatches(), refreshSelectedBatch(), onDataChanged()]);
      setSelectedPageId(result.entry.pageId);
      setFeedback(
        result.created
          ? "Fiche créée depuis l'import Notion."
          : "Fiche mise à jour depuis l'import Notion."
      );
    } catch (error) {
      onError(notionImportApplyErrorMessage(error));
    } finally {
      setIsApplying(false);
    }
  }, [loadBatches, onDataChanged, onError, refreshSelectedBatch, selectedBatchId, selectedEntry]);

  const handleImportPhoto = useCallback(async () => {
    if (!selectedBatchId || !selectedEntry) {
      return;
    }

    setIsImportingPhoto(true);
    setFeedback(null);

    try {
      await importAdminNotionEntryPhoto(selectedBatchId, selectedEntry.pageId);
      await Promise.all([loadBatches(), refreshSelectedBatch(), onDataChanged()]);
      setFeedback("Photo Notion importée sur la fiche.");
    } catch (error) {
      onError(notionImportPhotoErrorMessage(error));
    } finally {
      setIsImportingPhoto(false);
    }
  }, [loadBatches, onDataChanged, onError, refreshSelectedBatch, selectedBatchId, selectedEntry]);

  if (!session?.authenticated) {
    return (
      <section className="full-page-view" aria-labelledby="imports-title">
        <div className="full-page-header">
          <div>
            <p className="eyebrow">Imports Notion</p>
            <h2 id="imports-title">Connexion requise</h2>
          </div>
        </div>
      </section>
    );
  }

  if (!canAdmin) {
    return (
      <section className="full-page-view" aria-labelledby="imports-title">
        <div className="full-page-header">
          <div>
            <p className="eyebrow">Imports Notion</p>
            <h2 id="imports-title">Accès refusé</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="full-page-view imports-page" aria-labelledby="imports-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Imports Notion</p>
          <h2 id="imports-title">Prévisualisation des fiches importées</h2>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadBatches()}>
          Actualiser
        </button>
      </div>

      <div className="imports-layout">
        <section className="work-panel imports-batches-panel">
          <h3>Lots</h3>
          {isLoading && batches.length === 0 ? <p className="muted-copy">Chargement...</p> : null}
          <div className="request-list">
            <NotionImportsBatchList
              batches={batches}
              isLoading={isLoading}
              selectedBatchId={selectedBatchId}
              onSelectBatch={(batchId) => {
                setSelectedBatchId(batchId);
                setSelectedPageId(null);
                setFeedback(null);
              }}
            />
          </div>
        </section>

        <NotionImportsTable
          detail={detail}
          filteredEntries={filteredEntries}
          searchQuery={searchQuery}
          selectedPageId={selectedPageId}
          statusFilter={statusFilter}
          appliedFilter={appliedFilter}
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onAppliedFilterChange={setAppliedFilter}
          onSelectEntry={(pageId) => {
            setSelectedPageId(pageId);
            setFeedback(null);
          }}
        />

        <NotionImportDetailPanel
          feedback={feedback}
          isApplying={isApplying}
          isImportingPhoto={isImportingPhoto}
          selectedEntry={selectedEntry}
          onApplyEntry={() => void handleApplyEntry()}
          onImportPhoto={() => void handleImportPhoto()}
        />
      </div>
    </section>
  );
}
