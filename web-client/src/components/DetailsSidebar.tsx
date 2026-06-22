import type { PublicCharacterDetail, PublicHistoryEntry } from "../api";
import { CharacterSheet } from "./CharacterSheet";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type DetailsSidebarProps = {
  canEditDirectly: boolean;
  character: PublicCharacterDetail | null;
  history: PublicHistoryEntry[];
  isLoading: boolean;
  onClose: () => void;
  onContribute: () => void;
  onShare: () => void;
};

export function DetailsSidebar({
  canEditDirectly,
  character,
  history,
  isLoading,
  onClose,
  onContribute,
  onShare
}: DetailsSidebarProps) {
  return (
    <aside className="details-panel" aria-label="Fiche personnage">
      <button type="button" className="panel-icon-button details-close-button" onClick={onClose}>
        Fermer
      </button>
      {isLoading ? <LoadingBlock label="Chargement de la fiche..." /> : null}
      {!isLoading && !character ? (
        <EmptyBlock label="Fiche indisponible." />
      ) : character ? (
        <CharacterSheet
          canEditDirectly={canEditDirectly}
          character={character}
          history={history}
          onContribute={onContribute}
          onShare={onShare}
        />
      ) : null}
    </aside>
  );
}
