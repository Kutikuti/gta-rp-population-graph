import { useEffect, useState } from "react";

import type {
  AuthSession,
  ChangeRequestSummary,
  CharacterSnapshot,
  PersonalDataExport,
  PublicCharacterReference
} from "../api";
import {
  exportProfilePersonalData,
  getDiscordLinkUrl,
  getGoogleLinkUrl,
  getTwitchLinkUrl,
  listCharacterDirectory,
  listMyChangeRequests
} from "../api";
import { characterSnapshotFieldLabels } from "../constants";
import {
  formatCharacterSnapshotValue,
  isExpandedCharacterSnapshotField
} from "../utils/characterDraftFormat";
import { formatDate } from "../utils/format";
import { type AuthProvider, AuthProviderIcon, authProviderLabels } from "./AuthProviderIcon";
import { EmptyBlock, LoadingBlock } from "./StateBlock";

type ProfileViewProps = {
  session: AuthSession | null;
  onDisplayNameUpdate: (displayName: string) => Promise<boolean>;
  onIdentityUnlink: (provider: AuthProvider) => Promise<boolean>;
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

const providerLinkUrls = {
  google: getGoogleLinkUrl(),
  discord: getDiscordLinkUrl(),
  twitch: getTwitchLinkUrl()
} as const;

const displayNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u;

const visibleSnapshotEntries = (snapshot: CharacterSnapshot) =>
  (
    Object.entries(snapshot) as Array<
      [keyof CharacterSnapshot, CharacterSnapshot[keyof CharacterSnapshot]]
    >
  )
    .filter(([, value]) => value !== null && value !== "" && value !== undefined)
    .filter(([field, value]) => field !== "isRpDeath" || value === true);

export function ProfileView({
  session,
  onDisplayNameUpdate,
  onIdentityUnlink,
  onError
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(
    session?.authenticated ? session.user.displayName : ""
  );
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [characterOptions, setCharacterOptions] = useState<PublicCharacterReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [personalDataExport, setPersonalDataExport] = useState<PersonalDataExport | null>(null);

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
          setExpandedRequestId((current) => current ?? items[0]?.id ?? null);
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

  useEffect(() => {
    let isActive = true;

    listCharacterDirectory()
      .then((items) => {
        if (isActive) {
          setCharacterOptions(items);
        }
      })
      .catch(() => {
        onError("Impossible de charger le répertoire des personnages.");
      });

    return () => {
      isActive = false;
    };
  }, [onError]);

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
    const trimmedDisplayName = displayName.trim();

    if (
      trimmedDisplayName.length < 3 ||
      trimmedDisplayName.length > 40 ||
      !displayNamePattern.test(trimmedDisplayName)
    ) {
      onError(
        "Le nom public doit contenir 3 a 40 caracteres et commencer par une lettre ou un chiffre."
      );
      return;
    }

    setIsSaving(true);
    const isSaved = await onDisplayNameUpdate(trimmedDisplayName);
    setIsSaving(false);

    if (isSaved) {
      setDisplayName(trimmedDisplayName);
    }
  };

  const handleIdentityUnlinkClick = async (provider: AuthProvider) => {
    setUnlinkingProvider(provider);
    await onIdentityUnlink(provider);
    setUnlinkingProvider(null);
  };

  const handlePersonalDataExport = async () => {
    setIsExporting(true);

    try {
      setPersonalDataExport(await exportProfilePersonalData());
    } catch {
      onError("Impossible de préparer l'export de tes données personnelles.");
    } finally {
      setIsExporting(false);
    }
  };

  const characterNames = new Map(
    characterOptions.map((character) => [character.id, character.fullName] as const)
  );
  const identitiesByProvider = new Map(
    session.user.linkedIdentities.map((identity) => [identity.provider, identity] as const)
  );

  return (
    <section className="full-page-view" aria-labelledby="profile-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Profil utilisateur</p>
          <h2 id="profile-title">Nom public et contributions</h2>
        </div>
      </div>

      <div className="full-page-grid single-column">
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
              {(Object.keys(authProviderLabels) as AuthProvider[]).map((provider) => {
                const identity = identitiesByProvider.get(provider);

                if (identity) {
                  const isUnlinking = unlinkingProvider === provider;
                  const canUnlink = identity.canUnlink && !isUnlinking;
                  const actionLabel = isUnlinking
                    ? `Dissociation ${authProviderLabels[provider]}...`
                    : identity.canUnlink
                      ? `Dissocier ${authProviderLabels[provider]}`
                      : `${authProviderLabels[provider]} requis`;

                  return (
                    <button
                      key={provider}
                      type="button"
                      className={`ghost-button ${identity.canUnlink ? "danger-action" : ""}`}
                      disabled={!canUnlink}
                      aria-label={actionLabel}
                      title={
                        identity.canUnlink
                          ? `Dissocier ${authProviderLabels[provider]}`
                          : "Impossible de dissocier le dernier moyen de connexion."
                      }
                      onClick={() => {
                        void handleIdentityUnlinkClick(provider);
                      }}
                    >
                      <AuthProviderIcon provider={provider} className="auth-provider-mark" />
                      <span>{actionLabel}</span>
                    </button>
                  );
                }

                return provider in providerLinkUrls ? (
                  <a
                    key={provider}
                    href={providerLinkUrls[provider as keyof typeof providerLinkUrls]}
                    className="ghost-button auth-link profile-provider-link"
                    aria-label={`Lier ${authProviderLabels[provider]}`}
                    title={`Lier ${authProviderLabels[provider]}`}
                  >
                    <AuthProviderIcon provider={provider} className="auth-provider-mark" />
                    <span>Lier {authProviderLabels[provider]}</span>
                  </a>
                ) : (
                  <button
                    key={provider}
                    type="button"
                    className="ghost-button"
                    disabled
                    aria-label={`${authProviderLabels[provider]} à venir`}
                  >
                    <AuthProviderIcon provider={provider} className="auth-provider-mark" />
                    <span>{authProviderLabels[provider]} à venir</span>
                  </button>
                );
              })}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={isExporting}
                onClick={() => {
                  void handlePersonalDataExport();
                }}
              >
                {isExporting ? "Préparation..." : "Exporter mes données"}
              </button>
            </div>
            {personalDataExport ? (
              <div className="profile-export-panel">
                <h4>Export personnel</h4>
                <p className="muted-copy">
                  Préparé le {formatDate(personalDataExport.exportedAt)}. Cet export couvre le
                  compte et les identités liées actuellement stockés.
                </p>
                <div className="profile-export-grid">
                  <div className="profile-request-change">
                    <span>Email</span>
                    <strong className="profile-request-value">
                      {personalDataExport.account.email}
                    </strong>
                  </div>
                  <div className="profile-request-change">
                    <span>Role</span>
                    <strong className="profile-request-value">
                      {personalDataExport.account.role}
                    </strong>
                  </div>
                  <div className="profile-request-change">
                    <span>Dernière connexion</span>
                    <strong className="profile-request-value">
                      {personalDataExport.account.lastLoginAt
                        ? formatDate(personalDataExport.account.lastLoginAt)
                        : "Aucune"}
                    </strong>
                  </div>
                  <div className="profile-request-change">
                    <span>Comptes liés</span>
                    <strong className="profile-request-value">
                      {personalDataExport.linkedIdentities.length}
                    </strong>
                  </div>
                </div>
                <div className="profile-export-identities">
                  {personalDataExport.linkedIdentities.map((identity) => (
                    <div key={identity.id} className="profile-export-identity">
                      <strong>{authProviderLabels[identity.provider]}</strong>
                      <span>
                        {identity.providerEmail ?? identity.providerDisplayName ?? "Identité liée"}
                      </span>
                      <small>
                        Lié le {formatDate(identity.connectedAt)}
                        {identity.lastUsedAt
                          ? ` • Utilisé le ${formatDate(identity.lastUsedAt)}`
                          : ""}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="profile-sso-panel">
            <h3>Mes demandes</h3>
            {isLoading ? <LoadingBlock label="Chargement des demandes..." /> : null}
            {!isLoading && requests.length === 0 ? (
              <p className="muted-text">Aucune demande envoyée pour le moment.</p>
            ) : null}
            {!isLoading && requests.length > 0 ? (
              <div className="request-list compact-request-list">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className={`request-list-item ${expandedRequestId === request.id ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="request-list-toggle"
                      onClick={() => {
                        setExpandedRequestId((current) =>
                          current === request.id ? null : request.id
                        );
                      }}
                    >
                      <strong>
                        {requestTypeLabels[request.requestType]} -{" "}
                        {request.characterName ??
                          `${request.proposedSnapshot.firstName} ${request.proposedSnapshot.lastName}`}
                      </strong>
                      <span>{statusLabels[request.status]}</span>
                      <small>{formatDate(request.createdAt)}</small>
                    </button>

                    {expandedRequestId === request.id ? (
                      <div className="profile-request-details">
                        {visibleSnapshotEntries(request.proposedSnapshot).map(([field, value]) => {
                          const requestStreamerMap =
                            request.proposedStreamerName && request.proposedSnapshot.streamerId
                              ? new Map([
                                  [
                                    request.proposedSnapshot.streamerId,
                                    request.proposedStreamerName
                                  ]
                                ])
                              : undefined;

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
                                {formatCharacterSnapshotValue(field, value, {
                                  streamersById: requestStreamerMap,
                                  charactersById: characterNames
                                })}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
