import { useEffect, useState } from "react";

import type { AuthSession, ChangeRequestSummary } from "../api";
import { listMyChangeRequests } from "../api";
import { formatDate } from "../utils/format";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ProfileViewProps = {
  session: AuthSession | null;
  onDisplayNameUpdate: (displayName: string) => Promise<boolean>;
  onError: (message: string) => void;
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

export function ProfileView({ session, onDisplayNameUpdate, onError }: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(
    session?.authenticated ? session.user.displayName : ""
  );
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session?.authenticated) {
      setDisplayName(session.user.displayName);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.authenticated) {
      setRequests([]);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    listMyChangeRequests()
      .then((items) => {
        if (isActive) {
          setRequests(items);
        }
      })
      .catch(() => {
        onError("Impossible de charger tes contributions.");
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

  if (!session?.authenticated) {
    return (
      <section className="full-page-view" aria-labelledby="profile-title">
        <div className="full-page-grid single-column">
          <div className="work-panel">
            <EmptyBlock label="Connecte-toi pour accéder au profil." />
          </div>
        </div>
      </section>
    );
  }

  const submitDisplayName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    const isSaved = await onDisplayNameUpdate(displayName);
    setIsSaving(false);

    if (isSaved) {
      setDisplayName(displayName.trim());
    }
  };

  return (
    <section className="full-page-view" aria-labelledby="profile-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Profil utilisateur</p>
          <h2 id="profile-title">Nom public et contributions</h2>
        </div>
      </div>

      <div className="full-page-grid profile-layout">
        <div className="work-panel profile-main-panel">
          {session.user.mustChooseDisplayName ? (
            <p className="inline-feedback warning-text">
              Choisis un nom public avant de contribuer.
            </p>
          ) : null}
          <form className="snapshot-form" onSubmit={submitDisplayName}>
            <fieldset>
              <legend>Identité publique</legend>
              <label>
                Nom d'affichage public
                <input
                  value={displayName}
                  minLength={3}
                  maxLength={40}
                  pattern="[\p{L}\p{N}][\p{L}\p{N} _.'-]*"
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                  }}
                />
              </label>
              <p className="muted-copy">Email de connexion : {session.user.email}</p>
              <div className="form-actions">
                <button type="submit" className="primary-action" disabled={isSaving}>
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </fieldset>
          </form>

          <div className="profile-sso-panel">
            <h3>Comptes liés</h3>
            <div className="profile-sso-actions">
              <button type="button" className="ghost-button" disabled>
                Google connecté
              </button>
              <button type="button" className="ghost-button" disabled>
                Discord à venir
              </button>
              <button type="button" className="ghost-button" disabled>
                Twitch à venir
              </button>
            </div>
          </div>
        </div>

        <div className="work-panel side-work-panel">
          <h3>Mes demandes</h3>
          {isLoading ? <LoadingBlock label="Chargement des demandes..." /> : null}
          {!isLoading && requests.length === 0 ? (
            <EmptyBlock label="Aucune demande envoyée pour le moment." />
          ) : null}
          {!isLoading && requests.length > 0 ? (
            <div className="request-list compact-request-list">
              {requests.map((request) => (
                <article key={request.id} className="request-list-item">
                  <strong>
                    {requestTypeLabels[request.requestType]} -{" "}
                    {request.characterName ??
                      `${request.proposedSnapshot.firstName} ${request.proposedSnapshot.lastName}`}
                  </strong>
                  <span>{statusLabels[request.status]}</span>
                  <small>{formatDate(request.createdAt)}</small>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
