import type { AdminNotionImportBatch } from "../api";
import { formatDateTime } from "../utils/format";
import { countImportBatch } from "./notion-imports-shared";

type NotionImportsBatchListProps = {
  batches: AdminNotionImportBatch[];
  isLoading: boolean;
  selectedBatchId: string | null;
  onSelectBatch: (batchId: string) => void;
};

export function NotionImportsBatchList({
  batches,
  isLoading,
  selectedBatchId,
  onSelectBatch
}: NotionImportsBatchListProps) {
  return (
    <section className="work-panel imports-batches-panel">
      <h3>Lots</h3>
      {isLoading && batches.length === 0 ? <p className="muted-copy">Chargement...</p> : null}
      <div className="request-list">
        {batches.map((batch) => (
          <button
            key={batch.id}
            type="button"
            className={`request-row selectable-row ${selectedBatchId === batch.id ? "is-active" : ""}`}
            onClick={() => {
              onSelectBatch(batch.id);
            }}
          >
            <strong>{batch.sourceName}</strong>
            <small>{formatDateTime(batch.createdAt)}</small>
            <small>
              {countImportBatch(batch, "new")} nouveaux · {countImportBatch(batch, "failed")}{" "}
              erreurs · {countImportBatch(batch, "missing")} absents
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
