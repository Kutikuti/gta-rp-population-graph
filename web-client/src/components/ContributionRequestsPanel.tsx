import type { ChangeRequestSummary } from "../api";
import { formatDate } from "../utils/format";
import { LoadingBlock } from "./StateBlock";

type ContributionRequestsPanelProps = {
  isLoading: boolean;
  requests: ChangeRequestSummary[];
};

const statusLabels: Record<ChangeRequestSummary["status"], string> = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée"
};

export function ContributionRequestsPanel({ isLoading, requests }: ContributionRequestsPanelProps) {
  return (
    <aside className="work-panel side-work-panel">
      <h3>Mes demandes</h3>
      {isLoading ? <LoadingBlock label="Chargement des demandes..." /> : null}
      {!isLoading && requests.length ? (
        <div className="request-list">
          {requests.map((request) => (
            <div key={request.id} className="request-row">
              <strong>{request.characterName ?? "Personnage supprimé"}</strong>
              <span>{statusLabels[request.status]}</span>
              <small>{formatDate(request.createdAt)}</small>
            </div>
          ))}
        </div>
      ) : null}
      {!isLoading && !requests.length ? (
        <span className="muted-text">Aucune demande enregistrée.</span>
      ) : null}
    </aside>
  );
}
