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
  listCharacterDirectory,
  listModerationChangeRequests,
  listStreamers,
  type PublicCharacterReference,
  type PublicStreamer,
  rejectChangeRequest
} from "../api";
import { ModerationDetailPanel } from "./ModerationDetailPanel";
import { ModerationRequestList } from "./ModerationRequestList";
import { canModerate, diffSnapshots, getSelectedModerationRequest } from "./moderation-shared";

type ModerationViewProps = {
  session: AuthSession | null;
  onDataChanged: () => Promise<void>;
  onError: (message: string) => void;
};

export function ModerationView({ session, onDataChanged, onError }: ModerationViewProps) {
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
  const [streamers, setStreamers] = useState<PublicStreamer[]>([]);
  const [characterOptions, setCharacterOptions] = useState<PublicCharacterReference[]>([]);

  const selectedRequest = getSelectedModerationRequest(requests, selectedId);

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
    let isActive = true;

    Promise.all([listStreamers(), listCharacterDirectory()])
      .then(([streamerItems, characterItems]) => {
        if (!isActive) {
          return;
        }

        setStreamers(streamerItems);
        setCharacterOptions(characterItems);
      })
      .catch(() => {
        onError("Impossible de charger les données du formulaire.");
      });

    return () => {
      isActive = false;
    };
  }, [onError]);

  const streamerNames = useMemo(
    () => new Map(streamers.map((streamer) => [streamer.id, streamer.publicName] as const)),
    [streamers]
  );
  const characterNames = useMemo(
    () => new Map(characterOptions.map((character) => [character.id, character.fullName] as const)),
    [characterOptions]
  );

  useEffect(() => {
    if (!selectedRequest) {
      setCurrentSnapshot(null);
      setEditSnapshot(null);
      return;
    }

    if (selectedRequest.requestType === "create" || !selectedRequest.characterId) {
      setCurrentSnapshot(null);
      setEditSnapshot(selectedRequest.proposedSnapshot);
      setIsDetailLoading(false);
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
      await onDataChanged();
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
      if (!selectedRequest.characterId) {
        return;
      }

      const result = await editCharacterDirectly(selectedRequest.characterId, editSnapshot);
      await onDataChanged();
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
      </div>

      {!canModerate(session) ? (
        <section className="work-panel moderation-detail-panel">
          <p className="muted-copy">Accès réservé aux modérateurs.</p>
        </section>
      ) : (
        <div className="moderation-layout">
          <ModerationRequestList
            isLoading={isLoading}
            requests={requests}
            selectedRequestId={selectedRequest?.id ?? null}
            onSelectRequest={(requestId) => {
              setSelectedId(requestId);
              setFeedback(null);
              setLastChanges(null);
            }}
          />

          <ModerationDetailPanel
            characterNames={characterNames}
            characterOptions={characterOptions}
            editSnapshot={editSnapshot}
            feedback={feedback}
            isDetailLoading={isDetailLoading}
            isSubmitting={isSubmitting}
            lastChanges={lastChanges}
            rejectComment={rejectComment}
            selectedRequest={selectedRequest}
            streamerNames={streamerNames}
            streamers={streamers}
            visibleDiff={visibleDiff}
            onApprove={approveSelected}
            onChangeEditSnapshot={setEditSnapshot}
            onReject={rejectSelected}
            onRejectCommentChange={setRejectComment}
            onResetEditSnapshot={() => {
              if (selectedRequest) {
                setEditSnapshot(selectedRequest.proposedSnapshot);
              }
            }}
            onSubmitDirectEdit={submitDirectEdit}
          />
        </div>
      )}
    </section>
  );
}
