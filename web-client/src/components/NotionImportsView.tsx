import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportEntry,
  type AuthSession,
  getAdminNotionImportDetail,
  listAdminNotionImports
} from "../api";
import { formatDateTime } from "../utils/format";

type NotionImportsViewProps = {
  session: AuthSession | null;
  onError: (message: string) => void;
};

const statusLabels: Record<AdminNotionImportEntry["status"], string> = {
  new: "Nouveau",
  updated: "Modifié",
  unchanged: "Inchangé",
  missing: "Absent",
  failed: "Erreur"
};

const statusOptions: Array<AdminNotionImportEntry["status"] | "all"> = [
  "all",
  "failed",
  "new",
  "updated",
  "unchanged",
  "missing"
];

const count = (batch: AdminNotionImportBatch, key: string) => batch.totals[key] ?? 0;

const jsonPreview = (value: unknown) => JSON.stringify(value, null, 2);

export function NotionImportsView({ session, onError }: NotionImportsViewProps) {
  const [batches, setBatches] = useState<AdminNotionImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminNotionImportDetail | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminNotionImportEntry["status"] | "all">("all");
  const [isLoading, setIsLoading] = useState(false);

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
    const entries = detail?.entries ?? [];
    return statusFilter === "all"
      ? entries
      : entries.filter((entry) => entry.status === statusFilter);
  }, [detail, statusFilter]);

  const selectedEntry = useMemo(
    () => detail?.entries.find((entry) => entry.pageId === selectedPageId) ?? null,
    [detail, selectedPageId]
  );

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
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                className={`request-row selectable-row ${
                  selectedBatchId === batch.id ? "is-active" : ""
                }`}
                onClick={() => {
                  setSelectedBatchId(batch.id);
                  setSelectedPageId(null);
                }}
              >
                <strong>{batch.sourceName}</strong>
                <small>{formatDateTime(batch.createdAt)}</small>
                <small>
                  {count(batch, "new")} nouveaux · {count(batch, "failed")} erreurs ·{" "}
                  {count(batch, "missing")} absents
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="work-panel imports-main-panel">
          <div className="imports-summary">
            <div>
              <span>Nouveaux</span>
              <strong>{detail ? count(detail.batch, "new") : 0}</strong>
            </div>
            <div>
              <span>Modifiés</span>
              <strong>{detail ? count(detail.batch, "updated") : 0}</strong>
            </div>
            <div>
              <span>Erreurs</span>
              <strong>{detail ? count(detail.batch, "failed") : 0}</strong>
            </div>
            <div>
              <span>Absents</span>
              <strong>{detail ? count(detail.batch, "missing") : 0}</strong>
            </div>
          </div>

          <div className="imports-toolbar">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={`ghost-button ${statusFilter === status ? "is-active" : ""}`}
                onClick={() => {
                  setStatusFilter(status);
                }}
              >
                {status === "all" ? "Tous" : statusLabels[status]}
              </button>
            ))}
          </div>

          <div className="imports-table-scroll">
            <table className="imports-table">
              <thead>
                <tr>
                  <th>Statut</th>
                  <th>Personnage</th>
                  <th>Twitch</th>
                  <th>Organisation</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.pageId}
                    className={selectedPageId === entry.pageId ? "is-active" : ""}
                  >
                    <td>
                      <button
                        type="button"
                        className="imports-row-button"
                        onClick={() => {
                          setSelectedPageId(entry.pageId);
                        }}
                      >
                        <span className={`status-pill status-pill-${entry.status}`}>
                          {statusLabels[entry.status]}
                        </span>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="imports-row-button"
                        onClick={() => {
                          setSelectedPageId(entry.pageId);
                        }}
                      >
                        <strong>{entry.fullName}</strong>
                      </button>
                    </td>
                    <td>{entry.twitch ?? entry.streamer ?? "-"}</td>
                    <td>{entry.group ?? entry.business ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="work-panel imports-detail-panel">
          <h3>Détail</h3>
          {selectedEntry ? (
            <>
              <div className="import-detail-heading">
                <strong>{selectedEntry.fullName}</strong>
                <span className={`status-pill status-pill-${selectedEntry.status}`}>
                  {statusLabels[selectedEntry.status]}
                </span>
              </div>
              {selectedEntry.sourceUrl ? (
                <a href={selectedEntry.sourceUrl} target="_blank" rel="noreferrer">
                  Page Notion
                </a>
              ) : null}
              <dl className="import-detail-list">
                <div>
                  <dt>Vie</dt>
                  <dd>{selectedEntry.lifeStatus ?? "-"}</dd>
                </div>
                <div>
                  <dt>Twitch</dt>
                  <dd>{selectedEntry.twitch ?? selectedEntry.streamer ?? "-"}</dd>
                </div>
                <div>
                  <dt>Métier</dt>
                  <dd>{selectedEntry.business ?? "-"}</dd>
                </div>
                <div>
                  <dt>Groupe</dt>
                  <dd>{selectedEntry.group ?? "-"}</dd>
                </div>
                <div>
                  <dt>Tags</dt>
                  <dd>{selectedEntry.tags || "-"}</dd>
                </div>
              </dl>
              <details open>
                <summary>Snapshot mappé</summary>
                <pre>{jsonPreview(selectedEntry.mappedSnapshot)}</pre>
              </details>
              <details>
                <summary>Rapport</summary>
                <pre>{jsonPreview(selectedEntry.mappingReport)}</pre>
              </details>
              <details>
                <summary>Brut Notion</summary>
                <pre>{jsonPreview(selectedEntry.rawContent)}</pre>
              </details>
            </>
          ) : (
            <p className="muted-copy">Sélectionne une fiche importée.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
