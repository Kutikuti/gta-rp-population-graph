import slidersIcon from "../assets/misc/sliders.svg";
import { relationLabels } from "../constants";
import {
  allGraphRelationshipTypes,
  type GraphPreferences,
  type GraphRelationshipType,
  initialGraphPreferences
} from "../graph/graphPreferences";

type GraphPreferencesPanelProps = {
  isOpen: boolean;
  preferences: GraphPreferences;
  onOpen: () => void;
  onClose: () => void;
  onChange: (preferences: GraphPreferences) => void;
};

const toggleRelationshipType = (
  preferences: GraphPreferences,
  relationshipType: GraphRelationshipType
): GraphPreferences => {
  const nextVisibleTypes = preferences.visibleRelationshipTypes.includes(relationshipType)
    ? preferences.visibleRelationshipTypes.filter((entry) => entry !== relationshipType)
    : [...preferences.visibleRelationshipTypes, relationshipType];

  return {
    ...preferences,
    visibleRelationshipTypes:
      nextVisibleTypes.length > 0
        ? nextVisibleTypes
        : initialGraphPreferences.visibleRelationshipTypes
  };
};

export function GraphPreferencesPanel({
  isOpen,
  preferences,
  onOpen,
  onClose,
  onChange
}: GraphPreferencesPanelProps) {
  return (
    <section
      className={`graph-preferences-panel ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Préférences d'affichage du graphe"
    >
      {!isOpen ? (
        <button
          type="button"
          className="ghost-button graph-preferences-toggle"
          aria-label="Affichage du graphe"
          title="Affichage du graphe"
          onClick={onOpen}
        >
          <img
            src={slidersIcon}
            alt=""
            aria-hidden="true"
            className="graph-preferences-toggle-icon"
          />
        </button>
      ) : (
        <>
          <div className="panel-heading">
            <div>
              <h3>Préférences d'affichage</h3>
            </div>
            <button type="button" className="panel-icon-button" onClick={onClose}>
              X
            </button>
          </div>

          <label className="graph-preferences-checkbox">
            <input
              type="checkbox"
              checked={preferences.showDeceased}
              onChange={(event) => {
                onChange({ ...preferences, showDeceased: event.target.checked });
              }}
            />
            <span>Afficher les personnages décédés</span>
          </label>

          <div className="graph-preferences-section">
            <span className="graph-preferences-label">Disposition</span>
            <div className="graph-preferences-chip-list">
              <button
                type="button"
                className={`ghost-button compact-action ${
                  preferences.layoutMode === "grouped" ? "is-active-filter" : ""
                }`}
                onClick={() => {
                  onChange({ ...preferences, layoutMode: "grouped" });
                }}
              >
                Groupes
              </button>
              <button
                type="button"
                className={`ghost-button compact-action ${
                  preferences.layoutMode === "family" ? "is-active-filter" : ""
                }`}
                onClick={() => {
                  onChange({ ...preferences, layoutMode: "family" });
                }}
              >
                Familles
              </button>
              <button
                type="button"
                className={`ghost-button compact-action ${
                  preferences.layoutMode === "company" ? "is-active-filter" : ""
                }`}
                onClick={() => {
                  onChange({ ...preferences, layoutMode: "company" });
                }}
              >
                Entreprises
              </button>
              <button
                type="button"
                className={`ghost-button compact-action ${
                  preferences.layoutMode === "network" ? "is-active-filter" : ""
                }`}
                onClick={() => {
                  onChange({ ...preferences, layoutMode: "network" });
                }}
              >
                Libre
              </button>
            </div>
          </div>

          <div className="graph-preferences-section">
            <span className="graph-preferences-label">Relations visibles</span>
            <div className="graph-preferences-chip-list">
              {allGraphRelationshipTypes.map((relationshipType) => (
                <button
                  key={relationshipType}
                  type="button"
                  className={`ghost-button compact-action ${
                    preferences.visibleRelationshipTypes.includes(relationshipType)
                      ? "is-active-filter"
                      : ""
                  }`}
                  onClick={() => {
                    onChange(toggleRelationshipType(preferences, relationshipType));
                  }}
                >
                  {relationLabels[relationshipType]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onChange(initialGraphPreferences);
            }}
          >
            Réinitialiser
          </button>
        </>
      )}
    </section>
  );
}
