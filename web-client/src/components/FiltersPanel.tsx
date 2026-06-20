import type { CharacterFilters, PublicTag } from "../api";
import { isActiveFilters, lifeStatusLabels, verificationLabels } from "../constants";

type FiltersPanelProps = {
  filters: CharacterFilters;
  canSuggestCreation: boolean;
  tags: PublicTag[];
  resultSummary: string | null;
  onChange: (key: keyof CharacterFilters, value: string) => void;
  onSuggestCreation: () => void;
  onReset: () => void;
};

export function FiltersPanel({
  canSuggestCreation,
  filters,
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
        <button
          type="button"
          className="ghost-button"
          onClick={onReset}
          disabled={!isActiveFilters(filters)}
        >
          Réinitialiser
        </button>
      </div>

      <label className="field">
        <span>Texte</span>
        <input
          value={filters.q}
          onChange={(event) => {
            onChange("q", event.target.value);
          }}
          placeholder="Nom, téléphone, matricule..."
        />
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

      <label className="field">
        <span>Streamer</span>
        <input
          value={filters.streamer}
          onChange={(event) => {
            onChange("streamer", event.target.value);
          }}
          placeholder="Nom public"
        />
      </label>

      <label className="field">
        <span>Vérification</span>
        <select
          value={filters.verificationStatus}
          onChange={(event) => {
            onChange("verificationStatus", event.target.value);
          }}
        >
          <option value="">Toutes</option>
          {Object.entries(verificationLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {resultSummary ? <p className="search-result-summary">{resultSummary}</p> : null}
      {canSuggestCreation ? (
        <button type="button" className="ghost-button primary-action" onClick={onSuggestCreation}>
          Proposer une nouvelle fiche
        </button>
      ) : null}
    </>
  );
}
