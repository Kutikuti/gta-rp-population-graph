import { useEffect, useMemo, useState } from "react";

import {
  type AuthSession,
  approveChangeRequest,
  type ChangeDiff,
  type ChangeRequestSummary,
  type CharacterSnapshot,
  characterToSnapshot,
  editCharacterDirectly,
  getCharacter,
  listModerationChangeRequests,
  rejectChangeRequest
} from "../api";
import { formatDate } from "../utils/format";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ModerationViewProps = {
  session: AuthSession | null;
  onBack: () => void;
  onError: (message: string) => void;
};

const canModerate = (session: AuthSession | null) =>
  session?.authenticated &&
  (session.user.role.name === "moderator" || session.user.role.name === "administrator");

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "Non renseigné";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const diffSnapshots = (current: CharacterSnapshot | null, proposed: CharacterSnapshot) => {
  if (!current) {
    return [];
  }

  return Object.keys(proposed)
    .filter((key) => {
      const typedKey = key as keyof CharacterSnapshot;
      return (
        JSON.stringify(current[typedKey] ?? null) !== JSON.stringify(proposed[typedKey] ?? null)
      );
    })
    .map((key) => {
      const typedKey = key as keyof CharacterSnapshot;
      return {
        field: key,
        oldValue: current[typedKey],
        newValue: proposed[typedKey]
      };
    });
};

export function ModerationView({ session, onBack, onError }: ModerationViewProps) {
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<CharacterSnapshot | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<CharacterSnapshot | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastChanges, setLastChanges] = useState<ChangeDiff | null>(null);

  const selectedRequest =
    requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;

  useEffect(() => {
    if (!selectedId && requests[0]) {
      setSelectedId(requests[0].id);
    }
  }, [requests, selectedId]);

  useEffect(() => {
    if (!canModerate(session)) {
      setRequests([]);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    listModerationChangeRequests("pending")
      .then((items) => {
        if (isActive) {
          setRequests(items);
        }
      })
      .catch(() => {
        onError("Impossible de charger la file de modération.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onError, session]);

  useEffect(() => {
    if (!selectedRequest) {
      setCurrentSnapshot(null);
      setEditSnapshot(null);
      return;
    }

    let isActive = true;
    setIsDetailLoading(true);
    getCharacter(selectedRequest.characterId)
      .then((character) => {
        if (isActive) {
          setCurrentSnapshot(characterToSnapshot(character));
          setEditSnapshot(selectedRequest.proposedSnapshot);
        }
      })
      .catch(() => {
        onError("Impossible de charger la fiche actuelle.");
      })
      .finally(() => {
        if (isActive) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onError, selectedRequest]);

  const visibleDiff = useMemo(
    () => (selectedRequest ? diffSnapshots(currentSnapshot, selectedRequest.proposedSnapshot) : []),
    [currentSnapshot, selectedRequest]
  );

  const refreshAfterResolution = (resolved: ChangeRequestSummary, changes: ChangeDiff | null) => {
    setRequests((current) => current.filter((request) => request.id !== resolved.id));
    setSelectedId(null);
    setFeedback(`Demande ${resolved.status === "approved" ? "acceptée" : "refusée"}.`);
    setLastChanges(changes);
    setRejectComment("");
  };

  const approveSelected = async () => {
    if (!selectedRequest) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await approveChangeRequest(selectedRequest.id);
      refreshAfterResolution(result.request, result.changes);
    } catch {
      onError("Impossible d'accepter la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const rejectSelected = async () => {
    if (!selectedRequest) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await rejectChangeRequest(selectedRequest.id, rejectComment);
      refreshAfterResolution(result, null);
    } catch {
      onError("Impossible de refuser la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDirectEdit = async () => {
    if (!selectedRequest || !editSnapshot) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await editCharacterDirectly(selectedRequest.characterId, editSnapshot);
      setFeedback("Fiche modifiée directement.");
      setLastChanges(result.changes);
    } catch {
      onError("Impossible de modifier la fiche directement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="full-page-view" aria-labelledby="moderation-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Modération</p>
          <h2 id="moderation-title">Demandes de modification</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onBack}>
          Retour au graphe
        </button>
      </div>

      {!canModerate(session) ? (
        <EmptyBlock label="Accès réservé aux modérateurs." />
      ) : (
        <div className="moderation-layout">
          <aside className="work-panel moderation-list-panel">
            <h3>File en attente</h3>
            {isLoading ? <LoadingBlock label="Chargement..." /> : null}
            {!isLoading && requests.length ? (
              <div className="request-list">
                {requests.map((request) => (
                  <button
                    type="button"
                    key={request.id}
                    className={`request-row selectable-row ${selectedRequest?.id === request.id ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedId(request.id);
                      setFeedback(null);
                      setLastChanges(null);
                    }}
                  >
                    <strong>{request.characterName ?? "Personnage supprimé"}</strong>
                    <span>{request.userDisplayName ?? "Utilisateur inconnu"}</span>
                    <small>{formatDate(request.createdAt)}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {!isLoading && !requests.length ? (
              <span className="muted-text">Aucune demande en attente.</span>
            ) : null}
          </aside>

          <div className="work-panel moderation-detail-panel">
            {feedback ? <p className="inline-feedback success-text">{feedback}</p> : null}
            {lastChanges ? (
              <p className="inline-feedback">
                {Object.keys(lastChanges).length} champ modifié dans l'historique.
              </p>
            ) : null}
            {isDetailLoading ? <LoadingBlock label="Chargement du détail..." /> : null}
            {!isDetailLoading && selectedRequest ? (
              <>
                <div className="detail-heading">
                  <div>
                    <h3>{selectedRequest.characterName ?? "Personnage supprimé"}</h3>
                    <span className="muted-text">
                      Proposé par {selectedRequest.userDisplayName ?? "utilisateur inconnu"}
                    </span>
                  </div>
                </div>

                <section className="diff-panel">
                  <h3>Comparaison</h3>
                  {visibleDiff.length ? (
                    visibleDiff.map((change) => (
                      <div key={change.field} className="diff-row">
                        <strong>{change.field}</strong>
                        <span>{displayValue(change.oldValue)}</span>
                        <span>{displayValue(change.newValue)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="muted-text">Aucun écart détecté avec la fiche actuelle.</span>
                  )}
                </section>

                <div className="moderation-actions">
                  <button
                    type="button"
                    className="ghost-button primary-action"
                    disabled={isSubmitting}
                    onClick={approveSelected}
                  >
                    Accepter
                  </button>
                  <label>
                    <span>Commentaire de refus</span>
                    <textarea
                      rows={3}
                      value={rejectComment}
                      onChange={(event) => {
                        setRejectComment(event.target.value);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-button danger-action"
                    disabled={isSubmitting || !rejectComment.trim()}
                    onClick={rejectSelected}
                  >
                    Refuser
                  </button>
                </div>

                {editSnapshot ? (
                  <section className="direct-edit-panel">
                    <h3>Édition directe modérateur</h3>
                    <CharacterSnapshotForm
                      snapshot={editSnapshot}
                      submitLabel="Appliquer directement"
                      isSubmitting={isSubmitting}
                      onCancel={() => {
                        setEditSnapshot(selectedRequest.proposedSnapshot);
                      }}
                      onChange={setEditSnapshot}
                      onSubmit={submitDirectEdit}
                    />
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
