import type { ChangeRequestSummary } from "../api";
import { formatDate } from "../utils/format";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ModerationRequestListProps = {
  isLoading: boolean;
  requests: ChangeRequestSummary[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
};

export function ModerationRequestList({
  isLoading,
  requests,
  selectedRequestId,
  onSelectRequest
}: ModerationRequestListProps) {
  return (
    <aside className="work-panel moderation-list-panel">
      <h3>Demandes en attente</h3>
      {isLoading ? <LoadingBlock label="Chargement..." /> : null}
      {!isLoading && requests.length ? (
        <div className="request-list">
          {requests.map((request) => (
            <button
              type="button"
              key={request.id}
              className={`request-row selectable-row ${selectedRequestId === request.id ? "is-active" : ""}`}
              onClick={() => {
                onSelectRequest(request.id);
              }}
            >
              <strong className="request-title">
                {request.requestType === "create" ? (
                  <span className="request-type-badge" title="Demande de création">
                    <span aria-hidden="true">+</span>
                    Création
                  </span>
                ) : null}
                <span>{request.characterName ?? "Personnage supprimé"}</span>
              </strong>
              <span>{request.userDisplayName ?? "Utilisateur inconnu"}</span>
              <small>{formatDate(request.createdAt)}</small>
            </button>
          ))}
        </div>
      ) : null}
      {!isLoading && !requests.length ? <EmptyBlock label="Aucune demande en attente." /> : null}
    </aside>
  );
}
