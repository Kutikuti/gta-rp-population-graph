import { useMemo, useState } from "react";

import type { DataCompletenessReport } from "../api";
import { formatDate } from "../utils/format";

type DataCompletenessPanelProps = {
  isLoading: boolean;
  onEditCharacter?: (slug: string) => void;
  report: DataCompletenessReport | null;
  title?: string;
};

export function DataCompletenessPanel({
  isLoading,
  onEditCharacter,
  report,
  title = "Fiches à compléter"
}: DataCompletenessPanelProps) {
  const items = report?.items ?? [];
  const [query, setQuery] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [onlyImported, setOnlyImported] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (
          onlyReview &&
          !item.attentionFlags.some((flag) => flag === "À vérifier" || flag === "Contestée")
        ) {
          return false;
        }

        if (
          onlyImported &&
          !item.attentionFlags.some((flag) => flag === "Importée" || flag === "Communautaire")
        ) {
          return false;
        }

        if (onlyMissing && item.missingFields.length === 0) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          item.fullName,
          item.publicSlug,
          ...item.attentionFlags,
          ...item.missingFields.map((field) => field.label)
        ]
          .join(" ")
          .toLocaleLowerCase("fr");

        return haystack.includes(normalizedQuery);
      }),
    [items, normalizedQuery, onlyImported, onlyMissing, onlyReview]
  );

  return (
    <section className="work-panel completeness-panel">
      <div className="completeness-panel-header">
        <div>
          <h3>{title}</h3>
          <p className="muted-text">
            Repère les fiches avec des champs encore manquants ou un statut à revoir.
          </p>
        </div>
        {report ? (
          <div className="completeness-summary">
            <span>{report.summary.withMissingFields} incomplètes</span>
            <span>{report.summary.importedOrCommunity} importées/communautaires</span>
            <span>{report.summary.needsReview} à revoir</span>
          </div>
        ) : null}
      </div>

      <div className="completeness-toolbar">
        <label className="completeness-search">
          <span className="sr-only">Rechercher une fiche à compléter</span>
          <input
            type="search"
            value={query}
            placeholder="Rechercher une fiche ou un champ..."
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <div className="completeness-filters">
          <button
            type="button"
            className={`ghost-button compact-action ${onlyReview ? "is-active-filter" : ""}`}
            onClick={() => {
              setOnlyReview((current) => !current);
            }}
          >
            À revoir
          </button>
          <button
            type="button"
            className={`ghost-button compact-action ${onlyImported ? "is-active-filter" : ""}`}
            onClick={() => {
              setOnlyImported((current) => !current);
            }}
          >
            Importées
          </button>
          <button
            type="button"
            className={`ghost-button compact-action ${onlyMissing ? "is-active-filter" : ""}`}
            onClick={() => {
              setOnlyMissing((current) => !current);
            }}
          >
            Champs manquants
          </button>
        </div>
      </div>

      {isLoading ? <p className="muted-text">Chargement de la complétude...</p> : null}
      {!isLoading && report && items.length === 0 ? (
        <p className="muted-text">Aucune fiche ne remonte actuellement dans cette vue.</p>
      ) : null}
      {!isLoading && report && items.length > 0 && filteredItems.length === 0 ? (
        <p className="muted-text">Aucune fiche ne correspond aux filtres actuels.</p>
      ) : null}

      {!isLoading && filteredItems.length > 0 ? (
        <div className="completeness-list">
          {filteredItems.map((item) => (
            <article key={item.id} className="completeness-item">
              <div className="completeness-item-header">
                <div>
                  <strong>{item.fullName}</strong>
                  <small>Mis à jour le {formatDate(item.updatedAt)}</small>
                </div>
                <div className="completeness-item-actions">
                  <a
                    href={`/?character=${encodeURIComponent(item.publicSlug)}`}
                    className="ghost-button compact-action completeness-view-sheet-action"
                  >
                    Voir la fiche
                  </a>
                  {onEditCharacter ? (
                    <button
                      type="button"
                      className="ghost-button compact-action"
                      onClick={() => {
                        onEditCharacter(item.publicSlug);
                      }}
                    >
                      Modifier
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="completeness-chip-list">
                {item.attentionFlags.map((flag) => (
                  <span key={flag} className="completeness-chip">
                    {flag}
                  </span>
                ))}
              </div>

              {item.missingFields.length ? (
                <div className="completeness-missing-list">
                  {item.missingFields.map((field) => (
                    <span key={field.key}>{field.label}</span>
                  ))}
                </div>
              ) : (
                <p className="muted-text">Pas de champ manquant détecté sur cette fiche.</p>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
