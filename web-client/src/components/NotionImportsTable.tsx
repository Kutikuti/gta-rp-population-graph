import type { AdminNotionImportBatch, AdminNotionImportEntry } from "../api";
import {
  countImportBatch,
  type NotionImportAppliedFilter,
  notionImportAppliedOptions,
  notionImportStatusLabels,
  notionImportStatusOptions
} from "./notion-imports-shared";

type NotionImportsTableProps = {
  detail: { batch: AdminNotionImportBatch } | null;
  filteredEntries: AdminNotionImportEntry[];
  searchQuery: string;
  selectedPageId: string | null;
  statusFilter: AdminNotionImportEntry["status"] | "all";
  appliedFilter: NotionImportAppliedFilter;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: AdminNotionImportEntry["status"] | "all") => void;
  onAppliedFilterChange: (value: NotionImportAppliedFilter) => void;
  onSelectEntry: (pageId: string) => void;
};

export function NotionImportsTable({
  detail,
  filteredEntries,
  searchQuery,
  selectedPageId,
  statusFilter,
  appliedFilter,
  onSearchQueryChange,
  onStatusFilterChange,
  onAppliedFilterChange,
  onSelectEntry
}: NotionImportsTableProps) {
  return (
    <section className="work-panel imports-main-panel">
      <div className="imports-summary">
        <div>
          <span>Nouveaux</span>
          <strong>{detail ? countImportBatch(detail.batch, "new") : 0}</strong>
        </div>
        <div>
          <span>Modifiés</span>
          <strong>{detail ? countImportBatch(detail.batch, "updated") : 0}</strong>
        </div>
        <div>
          <span>Erreurs</span>
          <strong>{detail ? countImportBatch(detail.batch, "failed") : 0}</strong>
        </div>
        <div>
          <span>Absents</span>
          <strong>{detail ? countImportBatch(detail.batch, "missing") : 0}</strong>
        </div>
      </div>

      <div className="imports-toolbar">
        <input
          type="search"
          value={searchQuery}
          placeholder="Rechercher un nom"
          onChange={(event) => {
            onSearchQueryChange(event.target.value);
          }}
        />
        {notionImportStatusOptions.map((status) => (
          <button
            key={status}
            type="button"
            className={`ghost-button ${statusFilter === status ? "is-active" : ""}`}
            onClick={() => {
              onStatusFilterChange(status);
            }}
          >
            {status === "all" ? "Tous" : notionImportStatusLabels[status]}
          </button>
        ))}
        {notionImportAppliedOptions.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`ghost-button ${appliedFilter === filter ? "is-active" : ""}`}
            onClick={() => {
              onAppliedFilterChange(filter);
            }}
          >
            {filter === "all" ? "Toutes" : filter === "applied" ? "Appliquées" : "Non appliquées"}
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
              <tr key={entry.pageId} className={selectedPageId === entry.pageId ? "is-active" : ""}>
                <td>
                  <button
                    type="button"
                    className="imports-row-button"
                    onClick={() => {
                      onSelectEntry(entry.pageId);
                    }}
                  >
                    <span className={`status-pill status-pill-${entry.status}`}>
                      {notionImportStatusLabels[entry.status]}
                    </span>
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="imports-row-button"
                    onClick={() => {
                      onSelectEntry(entry.pageId);
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
                <td>{entry.group ?? entry.company ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
