import type { AdminNotionImportEntry } from "../api";
import { formatDateTime } from "../utils/format";
import {
  formatNotionLifeStatus,
  formatNotionVerificationStatus,
  jsonPreview,
  notionImportStatusLabels
} from "./notion-imports-shared";

type NotionImportDetailPanelProps = {
  feedback: string | null;
  isApplying: boolean;
  isImportingPhoto: boolean;
  selectedEntry: AdminNotionImportEntry | null;
  onApplyEntry: () => void;
  onImportPhoto: () => void;
};

export function NotionImportDetailPanel({
  feedback,
  isApplying,
  isImportingPhoto,
  selectedEntry,
  onApplyEntry,
  onImportPhoto
}: NotionImportDetailPanelProps) {
  return (
    <aside className="work-panel imports-detail-panel">
      <h3>Détail</h3>
      {selectedEntry ? (
        <>
          <div className="import-detail-heading">
            <strong>{selectedEntry.fullName}</strong>
            <span className={`status-pill status-pill-${selectedEntry.status}`}>
              {notionImportStatusLabels[selectedEntry.status]}
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
            onClick={onApplyEntry}
            disabled={
              isApplying || selectedEntry.status === "failed" || selectedEntry.status === "missing"
            }
          >
            {isApplying ? "Application..." : "Appliquer la fiche"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={onImportPhoto}
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
              <dd>{formatNotionLifeStatus(selectedEntry.lifeStatus ?? null)}</dd>
            </div>
            <div>
              <dt>Vérification</dt>
              <dd>{formatNotionVerificationStatus(selectedEntry.mappedSnapshot)}</dd>
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
  );
}
