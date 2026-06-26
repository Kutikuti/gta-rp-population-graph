import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportEntry,
  ApiRequestError,
  type AuthSession,
  applyAdminNotionImportEntry,
  getAdminNotionImportDetail,
  importAdminNotionEntryPhoto,
  type LifeStatus,
  listAdminNotionImports,
  type VerificationStatus
} from "../api";
import { lifeStatusLabels, verificationLabels } from "../constants";
import { formatDateTime } from "../utils/format";

type NotionImportsViewProps = {
  session: AuthSession | null;
  onDataChanged: () => Promise<void>;
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
const appliedOptions = ["all", "pending", "applied"] as const;
type AppliedFilter = (typeof appliedOptions)[number];

const count = (batch: AdminNotionImportBatch, key: string) => batch.totals[key] ?? 0;

const jsonPreview = (value: unknown) => JSON.stringify(value, null, 2);
const snapshotString = (snapshot: Record<string, unknown>, key: string) =>
  typeof snapshot[key] === "string" && snapshot[key].trim() ? snapshot[key].trim() : null;

const notionImportApplyErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return "La fiche importée n'a pas pu être appliquée.";
  }

  switch (error.code) {
    case "NOTION_IMPORT_ENTRY_NOT_APPLICABLE":
      return "Cette entrée est en erreur ou absente de la source, elle ne peut pas être appliquée.";
    case "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT":
      return "Le snapshot mappé est incomplet. Corrige d'abord le mapping.";
    case "NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER":
      return "Plusieurs fiches existantes correspondent déjà à ce nom. Le rattachement manuel sera nécessaire.";
    case "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS":
      return "Certaines relations restent ambiguës. Le rattachement automatique a été bloqué pour éviter une mauvaise liaison.";
    case "NOTION_IMPORT_ENTRY_NOT_FOUND":
      return "Cette entrée d'import n'existe plus.";
    default:
      return error.message || "La fiche importée n'a pas pu être appliquée.";
  }
};

const notionImportPhotoErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return "La photo Notion n'a pas pu être importée.";
  }

  switch (error.code) {
    case "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY":
      return "Applique d'abord la fiche avant d'importer sa photo.";
    case "NOTION_IMPORT_ENTRY_NO_PHOTO":
      return "Cette fiche importée ne contient pas de photo exploitable.";
    case "NOTION_IMPORT_ENTRY_INVALID_PHOTO":
      return error.message || "La photo distante a été refusée par le pipeline de sécurité.";
    case "NOTION_IMPORT_ENTRY_NOT_FOUND":
      return "Cette entrée d'import n'existe plus.";
    default:
      return error.message || "La photo Notion n'a pas pu être importée.";
  }
};

export function NotionImportsView({ session, onDataChanged, onError }: NotionImportsViewProps) {
  const [batches, setBatches] = useState<AdminNotionImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminNotionImportDetail | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminNotionImportEntry["status"] | "all">("all");
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>("all");
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
                  setFeedback(null);
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
            <input
              type="search"
              value={searchQuery}
              placeholder="Rechercher un nom"
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
            />
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
            {appliedOptions.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`ghost-button ${appliedFilter === filter ? "is-active" : ""}`}
                onClick={() => {
                  setAppliedFilter(filter);
                }}
              >
                {filter === "all"
                  ? "Toutes"
                  : filter === "applied"
                    ? "Appliquées"
                    : "Non appliquées"}
              </button>
            ))}
          </div>

          <div className="imports-table-scroll">
            <table className="imports-table">
              <thead>
                <tr>
                  <th>Statut</th>
                  <th>Personnage</th>
                  <th>Suivi</th>
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
                          setFeedback(null);
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
                          setFeedback(null);
                        }}
                      >
                        <strong>{entry.fullName}</strong>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          entry.appliedCharacterId ? "status-pill-unchanged" : "status-pill-updated"
                        }`}
                      >
                        {entry.appliedCharacterId ? "Appliquée" : "À faire"}
                      </span>
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
              <button
                type="button"
                className="ghost-button primary-action"
                onClick={() => void handleApplyEntry()}
                disabled={
                  isApplying ||
                  selectedEntry.status === "failed" ||
                  selectedEntry.status === "missing"
                }
              >
                {isApplying ? "Application..." : "Appliquer la fiche"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleImportPhoto()}
                disabled={
                  isImportingPhoto ||
                  !selectedEntry.appliedCharacterId ||
                  selectedEntry.photoReferences.length === 0
                }
              >
                {isImportingPhoto ? "Import photo..." : "Importer la photo"}
              </button>
              {feedback ? <p className="inline-feedback success-text">{feedback}</p> : null}
              <dl className="import-detail-list">
                <div>
                  <dt>Vie</dt>
                  <dd>
                    {selectedEntry.lifeStatus
                      ? (lifeStatusLabels[selectedEntry.lifeStatus as LifeStatus] ??
                        selectedEntry.lifeStatus)
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Vérification</dt>
                  <dd>
                    {snapshotString(selectedEntry.mappedSnapshot, "verificationStatus")
                      ? (verificationLabels[
                          snapshotString(
                            selectedEntry.mappedSnapshot,
                            "verificationStatus"
                          ) as VerificationStatus
                        ] ?? snapshotString(selectedEntry.mappedSnapshot, "verificationStatus"))
                      : "-"}
                  </dd>
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
                <div>
                  <dt>Photos</dt>
                  <dd>{selectedEntry.photoReferences.length}</dd>
                </div>
                <div>
                  <dt>Application</dt>
                  <dd>{selectedEntry.appliedAt ? formatDateTime(selectedEntry.appliedAt) : "-"}</dd>
                </div>
              </dl>
              {selectedEntry.photoReferences.length > 0 ? (
                <div className="import-photo-list">
                  <img
                    src={selectedEntry.photoReferences[0]}
                    alt={selectedEntry.fullName}
                    className="sheet-photo"
                  />
                  {selectedEntry.photoReferences.map((reference, index) => (
                    <a key={reference} href={reference} target="_blank" rel="noreferrer">
                      Photo Notion {index + 1}
                    </a>
                  ))}
                </div>
              ) : null}
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
