import type { ChangeRequestSummary, CharacterSnapshot, PublicCharacterReference } from "../api";
import { characterSnapshotFieldLabels } from "../constants";
import {
  formatCharacterSnapshotValue,
  isExpandedCharacterSnapshotField
} from "../utils/characterDraftFormat";
import { formatDate } from "../utils/format";
import { LoadingBlock } from "./StateBlock";

type ProfileRequestsSectionProps = {
  characterOptions: PublicCharacterReference[];
  expandedRequestId: string | null;
  isLoading: boolean;
  requests: ChangeRequestSummary[];
  onExpandedRequestChange: (requestId: string | null) => void;
};

const statusLabels = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée"
} as const;

const requestTypeLabels = {
  update: "Modification",
  create: "Création"
} as const;

const visibleSnapshotEntries = (snapshot: CharacterSnapshot) =>
  (
    Object.entries(snapshot) as Array<
      [keyof CharacterSnapshot, CharacterSnapshot[keyof CharacterSnapshot]]
    >
  )
    .filter(([, value]) => value !== null && value !== "" && value !== undefined)
    .filter(([field, value]) => field !== "isRpDeath" || value === true);

export function ProfileRequestsSection({
  characterOptions,
  expandedRequestId,
  isLoading,
  requests,
  onExpandedRequestChange
}: ProfileRequestsSectionProps) {
  const characterNames = new Map(
    characterOptions.map((character) => [character.id, character.fullName] as const)
  );

  return (
    <div className="profile-sso-panel">
      <h3>Mes demandes</h3>
      {isLoading ? <LoadingBlock label="Chargement des demandes..." /> : null}
      {!isLoading && requests.length === 0 ? (
        <p className="muted-text">Aucune demande envoyée pour le moment.</p>
      ) : null}
      {!isLoading && requests.length > 0 ? (
        <div className="request-list compact-request-list">
          {requests.map((request) => (
            <ProfileRequestItem
              key={request.id}
              characterNames={characterNames}
              isExpanded={expandedRequestId === request.id}
              request={request}
              onToggle={() => {
                onExpandedRequestChange(expandedRequestId === request.id ? null : request.id);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProfileRequestItem({
  characterNames,
  isExpanded,
  request,
  onToggle
}: {
  characterNames: Map<string, string>;
  isExpanded: boolean;
  request: ChangeRequestSummary;
  onToggle: () => void;
}) {
  return (
    <article className={`request-list-item ${isExpanded ? "is-expanded" : ""}`}>
      <button type="button" className="request-list-toggle" onClick={onToggle}>
        <strong>
          {requestTypeLabels[request.requestType]} -{" "}
          {request.characterName ??
            `${request.proposedSnapshot.firstName} ${request.proposedSnapshot.lastName}`}
        </strong>
        <span>{statusLabels[request.status]}</span>
        <small>{formatDate(request.createdAt)}</small>
      </button>

      {isExpanded ? (
        <div className="profile-request-details">
          {visibleSnapshotEntries(request.proposedSnapshot).map(([field, value]) => {
            const requestStreamerMap =
              request.proposedStreamerName && request.proposedSnapshot.streamerId
                ? new Map([[request.proposedSnapshot.streamerId, request.proposedStreamerName]])
                : undefined;
            const snapshotFormatOptions = requestStreamerMap
              ? { streamersById: requestStreamerMap, charactersById: characterNames }
              : { charactersById: characterNames };

            return (
              <div key={field} className="profile-request-change">
                <span>{characterSnapshotFieldLabels[field]}</span>
                <strong
                  className={
                    isExpandedCharacterSnapshotField(field)
                      ? "profile-request-value profile-request-value-expanded"
                      : "profile-request-value"
                  }
                >
                  {formatCharacterSnapshotValue(field, value, snapshotFormatOptions)}
                </strong>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
