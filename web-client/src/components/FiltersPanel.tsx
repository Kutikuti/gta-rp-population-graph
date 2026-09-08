import type { RefObject } from "react";

import type { CharacterFilters, PublicTag } from "../api";
import { isActiveFilters, lifeStatusLabels } from "../constants";

type FiltersPanelProps = {
  filters: CharacterFilters;
  companies: string[];
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  canSuggestCreation: boolean;
  creationActionLabel: string;
  onClose: () => void;
  tags: PublicTag[];
  resultSummary: string | null;
  onChange: (key: keyof CharacterFilters, value: string) => void;
  onSuggestCreation: () => void;
  onReset: () => void;
};

export function FiltersPanel({
  canSuggestCreation,
  creationActionLabel,
  filters,
  companies,
  closeButtonRef,
  onClose,
  tags,
  resultSummary,
  onChange,
  onSuggestCreation,
  onReset
}: FiltersPanelProps) {
  return (
    <>
      <div className="panel-heading">
        <h2>Recherche</h2>
        <div className="panel-heading-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onReset}
            disabled={!isActiveFilters({ ...filters, twitchLive: "" })}
          >
            Réinitialiser
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="panel-icon-button"
            aria-label="Replier la recherche"
            onClick={onClose}
          >
            X
          </button>
        </div>
      </div>

      <label className="field">
        <span>Recherche universelle</span>
        <input
          value={filters.q}
          onChange={(event) => {
            onChange("q", event.target.value);
          }}
          placeholder="Nom, streamer, téléphone, matricule..."
        />
      </label>

      <label className="field">
        <span>Entreprise</span>
        <select
          value={filters.company}
          onChange={(event) => {
            onChange("company", event.target.value);
          }}
        >
          <option value="">Toutes les entreprises</option>
          {filters.company && !companies.includes(filters.company) ? (
            <option value={filters.company}>{filters.company}</option>
          ) : null}
          {companies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Statut vital</span>
        <select
          value={filters.lifeStatus}
          onChange={(event) => {
            onChange("lifeStatus", event.target.value);
          }}
        >
          <option value="">Tous</option>
          {Object.entries(lifeStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Tag</span>
        <select
          value={filters.tag}
          onChange={(event) => {
            onChange("tag", event.target.value);
          }}
        >
          <option value="">Tous</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>

      {resultSummary ? <p className="search-result-summary">{resultSummary}</p> : null}
      {canSuggestCreation ? (
        <button type="button" className="ghost-button primary-action" onClick={onSuggestCreation}>
          {creationActionLabel}
        </button>
      ) : null}
    </>
  );
}
