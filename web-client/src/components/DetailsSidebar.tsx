import type { PublicCharacterDetail, PublicHistoryEntry } from "../api";
import { CharacterSheet } from "./CharacterSheet";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type DetailsSidebarProps = {
  character: PublicCharacterDetail | null;
  history: PublicHistoryEntry[];
  isLoading: boolean;
  onClose: () => void;
};

export function DetailsSidebar({ character, history, isLoading, onClose }: DetailsSidebarProps) {
  return (
    <aside className="details-panel" aria-label="Fiche personnage">
      <button type="button" className="panel-icon-button details-close-button" onClick={onClose}>
        Fermer
      </button>
      {isLoading ? <LoadingBlock label="Chargement de la fiche..." /> : null}
      {!isLoading && !character ? (
        <EmptyBlock label="Fiche indisponible." />
      ) : character ? (
        <CharacterSheet character={character} history={history} />
      ) : null}
    </aside>
  );
}
