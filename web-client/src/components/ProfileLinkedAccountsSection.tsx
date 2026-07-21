import type { AuthenticatedUser, PersonalDataExport } from "../api";
import { getDiscordLinkUrl, getGoogleLinkUrl, getTwitchLinkUrl } from "../api";
import { formatDate } from "../utils/format";
import { type AuthProvider, AuthProviderIcon, authProviderLabels } from "./AuthProviderIcon";

type ProfileLinkedAccountsSectionProps = {
  identities: AuthenticatedUser["linkedIdentities"];
  isExporting: boolean;
  personalDataExport: PersonalDataExport | null;
  unlinkingProvider: string | null;
  onExportPersonalData: () => void;
  onIdentityUnlink: (provider: AuthProvider) => void;
};

const providerLinkUrls = {
  google: getGoogleLinkUrl(),
  discord: getDiscordLinkUrl(),
  twitch: getTwitchLinkUrl()
} as const;

export function ProfileLinkedAccountsSection({
  identities,
  isExporting,
  personalDataExport,
  unlinkingProvider,
  onExportPersonalData,
  onIdentityUnlink
}: ProfileLinkedAccountsSectionProps) {
  const identitiesByProvider = new Map(
    identities.map((identity) => [identity.provider, identity] as const)
  );

  return (
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
                  onIdentityUnlink(provider);
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
          onClick={onExportPersonalData}
        >
          {isExporting ? "Préparation..." : "Exporter mes données"}
        </button>
      </div>
      {personalDataExport ? <ProfilePersonalDataExport exportData={personalDataExport} /> : null}
    </div>
  );
}

function ProfilePersonalDataExport({ exportData }: { exportData: PersonalDataExport }) {
  return (
    <div className="profile-export-panel">
      <h4>Export personnel</h4>
      <p className="muted-copy">
        Préparé le {formatDate(exportData.exportedAt)}. Cet export couvre le compte et les identités
        liées actuellement stockés.
      </p>
      <div className="profile-export-grid">
        <div className="profile-request-change">
          <span>Email</span>
          <strong className="profile-request-value">{exportData.account.email}</strong>
        </div>
        <div className="profile-request-change">
          <span>Role</span>
          <strong className="profile-request-value">{exportData.account.role}</strong>
        </div>
        <div className="profile-request-change">
          <span>Dernière connexion</span>
          <strong className="profile-request-value">
            {exportData.account.lastLoginAt ? formatDate(exportData.account.lastLoginAt) : "Aucune"}
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Comptes liés</span>
          <strong className="profile-request-value">{exportData.linkedIdentities.length}</strong>
        </div>
      </div>
      <div className="profile-export-identities">
        {exportData.linkedIdentities.map((identity) => (
          <div key={identity.id} className="profile-export-identity">
            <strong>{authProviderLabels[identity.provider]}</strong>
            <span>{identity.providerEmail ?? identity.providerDisplayName ?? "Identité liée"}</span>
            <small>
              Lié le {formatDate(identity.connectedAt)}
              {identity.lastUsedAt ? ` • Utilisé le ${formatDate(identity.lastUsedAt)}` : ""}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
