import { useEffect, useState } from "react";

import {
  type AuthSession,
  type ChangeRequestSummary,
  type CharacterSnapshot,
  characterToSnapshot,
  createChangeRequest,
  listMyChangeRequests,
  type PublicCharacterDetail
} from "../api";
import { formatDate } from "../utils/format";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ContributionViewProps = {
  character: PublicCharacterDetail | null;
  session: AuthSession | null;
  onBack: () => void;
  onError: (message: string) => void;
};

const statusLabels: Record<ChangeRequestSummary["status"], string> = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée"
};

export function ContributionView({ character, session, onBack, onError }: ContributionViewProps) {
  const [snapshot, setSnapshot] = useState<CharacterSnapshot | null>(
    character ? characterToSnapshot(character) : null
  );
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(character ? characterToSnapshot(character) : null);
  }, [character]);

  useEffect(() => {
    if (!session?.authenticated) {
      setRequests([]);
      return;
    }

    let isActive = true;
    setIsLoadingRequests(true);
    listMyChangeRequests()
      .then((items) => {
        if (isActive) {
          setRequests(items);
        }
      })
      .catch(() => {
        onError("Impossible de charger vos demandes.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingRequests(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onError, session]);

  const submit = async () => {
    if (!character || !snapshot) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const created = await createChangeRequest(character.id, snapshot);
      setRequests((current) => [created, ...current]);
      setFeedback("Demande envoyée en modération.");
    } catch {
      onError("Impossible d'envoyer la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="full-page-view" aria-labelledby="contribution-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Contribution</p>
          <h2 id="contribution-title">
            {character ? `Proposer une correction pour ${character.fullName}` : "Contribution"}
          </h2>
        </div>
        <button type="button" className="ghost-button" onClick={onBack}>
          Retour au graphe
        </button>
      </div>

      {!session?.authenticated ? (
        <EmptyBlock label="Connexion Google requise pour proposer une modification." />
      ) : !character || !snapshot ? (
        <EmptyBlock label="Sélectionnez un personnage depuis le graphe avant de contribuer." />
      ) : (
        <div className="full-page-grid">
          <div className="work-panel">
            {feedback ? <p className="inline-feedback success-text">{feedback}</p> : null}
            <CharacterSnapshotForm
              snapshot={snapshot}
              submitLabel="Envoyer la demande"
              isSubmitting={isSubmitting}
              onCancel={onBack}
              onChange={setSnapshot}
              onSubmit={submit}
            />
          </div>

          <aside className="work-panel side-work-panel">
            <h3>Mes demandes</h3>
            {isLoadingRequests ? <LoadingBlock label="Chargement des demandes..." /> : null}
            {!isLoadingRequests && requests.length ? (
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
            {!isLoadingRequests && !requests.length ? (
              <span className="muted-text">Aucune demande enregistrée.</span>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}
