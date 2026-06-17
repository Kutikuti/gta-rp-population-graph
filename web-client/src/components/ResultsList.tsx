import type { PublicCharacterSummary } from "../api";
import { lifeStatusLabels } from "../constants";
import { EmptyBlock } from "./StateBlock";

type ResultsListProps = {
  characters: PublicCharacterSummary[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
};

export function ResultsList({ characters, selectedId, isLoading, onSelect }: ResultsListProps) {
  return (
    <section className="results-list" aria-label="Resultats de recherche">
      <div className="panel-heading panel-heading-tight">
        <h2>Resultats</h2>
        {isLoading ? <span className="inline-status">Chargement</span> : <span>{characters.length}</span>}
      </div>

      {characters.length === 0 && !isLoading ? (
        <EmptyBlock label="Aucun resultat." />
      ) : (
        characters.map((character) => (
          <button
            type="button"
            key={character.id}
            className={`result-row ${character.id === selectedId ? "is-selected" : ""}`}
            onClick={() => {
              onSelect(character.id);
            }}
          >
            <span className="result-name">{character.fullName}</span>
            <span className="result-meta">
              {lifeStatusLabels[character.lifeStatus]} · {character.streamer?.publicName ?? "Streamer inconnu"}
            </span>
          </button>
        ))
      )}
    </section>
  );
}
