import { useEffect, useState } from "react";

import {
  type AuthSession,
  type CharacterCreationContext,
  type ChangeRequestSummary,
  type CharacterSnapshot,
  characterToSnapshot,
  createCharacterCreationRequest,
  createChangeRequest,
  editCharacterDirectly,
  listMyChangeRequests,
  type PublicCharacterDetail
} from "../api";
import { formatDate } from "../utils/format";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ContributionViewProps = {
  character: PublicCharacterDetail | null;
  creationContext: CharacterCreationContext | null;
  session: AuthSession | null;
  onDataChanged: () => Promise<void>;
  onError: (message: string) => void;
  onSubmitted: (message: string, closeContribution: boolean) => void;
};

const statusLabels: Record<ChangeRequestSummary["status"], string> = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée"
};

const canEditDirectly = (session: AuthSession | null) =>
  session?.authenticated &&
  (session.user.role.name === "moderator" || session.user.role.name === "administrator");

const snapshotFromSearch = (context: CharacterCreationContext): CharacterSnapshot => {
  const parts = context.q.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...lastNameParts] = parts;

  return {
    firstName,
    lastName: lastNameParts.join(" "),
    nickname: null,
    birthDate: null,
    lifeStatus: "unknown",
    deathOrDepartureDate: null,
    photoUrl: null,
    businessName: null,
    businessRank: null,
    businessBadgeNumber: null,
    phoneNumber: null,
    streamerId: null,
    socialLinks: null,
    groupName: null,
    groupRole: null,
    district: null,
    isRpDeath: false,
    policeRank: null,
    policeBadgeNumber: null,
    previousCharacters: null,
    verificationStatus: "to_check",
    sourceNote: null
  };
};

const snapshotFromProps = (
  character: PublicCharacterDetail | null,
  creationContext: CharacterCreationContext | null
) => {
  if (creationContext) {
    return snapshotFromSearch(creationContext);
  }

  if (character) {
    return characterToSnapshot(character);
  }

  return null;
};

export function ContributionView({
  character,
  creationContext,
  session,
  onDataChanged,
  onError,
  onSubmitted
}: ContributionViewProps) {
  const [snapshot, setSnapshot] = useState<CharacterSnapshot | null>(
    snapshotFromProps(character, creationContext)
  );
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(snapshotFromProps(character, creationContext));
  }, [character, creationContext]);

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
    if (!snapshot || (!character && !creationContext)) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (character && !creationContext && canEditDirectly(session)) {
        await editCharacterDirectly(character.id, snapshot);
        await onDataChanged();
        onSubmitted("Fiche mise à jour.", true);
        return;
      }

      const created = creationContext
        ? await createCharacterCreationRequest(snapshot, creationContext)
        : character
          ? await createChangeRequest(character.id, snapshot)
          : null;

      if (!created) {
        return;
      }
      setRequests((current) => [created, ...current]);
      if (creationContext) {
        onSubmitted("Demande envoyée en modération.", true);
      } else {
        setFeedback("Demande envoyée en modération.");
      }
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
            {character && !creationContext
              ? `Proposer une correction pour ${character.fullName}`
              : "Proposer une nouvelle fiche"}
          </h2>
        </div>
      </div>

      {!session?.authenticated ? (
        <EmptyBlock label="Connexion Google requise pour proposer une modification." />
      ) : !snapshot || (!character && !creationContext) ? (
        <EmptyBlock label="Sélectionnez un personnage ou relancez une recherche avant de contribuer." />
      ) : (
        <div className="full-page-grid">
          <div className="work-panel">
            {feedback ? <p className="inline-feedback success-text">{feedback}</p> : null}
            <CharacterSnapshotForm
              snapshot={snapshot}
              submitLabel={
                character && !creationContext && canEditDirectly(session)
                  ? "Appliquer la modification"
                  : "Envoyer la demande"
              }
              isSubmitting={isSubmitting}
              onCancel={() => {
                onSubmitted("", true);
              }}
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
