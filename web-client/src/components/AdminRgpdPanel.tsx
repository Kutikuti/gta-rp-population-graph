import type { AdminUser, AdminUserPersonalDataExport } from "../api";
import { formatDate } from "../utils/format";
import { roleLabels } from "./admin-shared";

type IdentityProvider = AdminUserPersonalDataExport["linkedIdentities"][number]["provider"];

type AdminRgpdPanelProps = {
  exportData: AdminUserPersonalDataExport;
  isLoading: boolean;
  onAnonymizeUser: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onUnlinkIdentity: (user: AdminUser, provider: IdentityProvider) => void;
};

const providerLabels = {
  google: "Google",
  discord: "Discord",
  twitch: "Twitch"
} as const;

export function AdminRgpdPanel({
  exportData,
  isLoading,
  onAnonymizeUser,
  onRevokeSessions,
  onUnlinkIdentity
}: AdminRgpdPanelProps) {
  return (
    <div className="admin-rgpd-panel">
      <div>
        <h4>Données RGPD</h4>
        <p className="muted-copy">
          Export préparé le {formatDate(exportData.exportedAt)} pour {exportData.user.displayName}.
        </p>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="ghost-button danger-action"
          disabled={isLoading}
          onClick={() => {
            onRevokeSessions(exportData.user);
          }}
        >
          Révoquer les sessions
        </button>
        <button
          type="button"
          className="ghost-button danger-action"
          disabled={isLoading}
          onClick={() => {
            onAnonymizeUser(exportData.user);
          }}
        >
          Anonymiser le compte
        </button>
      </div>
      <div className="profile-export-grid">
        <div className="profile-request-change">
          <span>Email</span>
          <strong className="profile-request-value">{exportData.user.email}</strong>
        </div>
        <div className="profile-request-change">
          <span>Rôle</span>
          <strong className="profile-request-value">{roleLabels[exportData.user.role.name]}</strong>
        </div>
        <div className="profile-request-change">
          <span>Sessions actives</span>
          <strong className="profile-request-value">
            {exportData.sessions.active} / {exportData.sessions.total}
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Dernière session</span>
          <strong className="profile-request-value">
            {exportData.sessions.latestExpiryAt
              ? formatDate(exportData.sessions.latestExpiryAt)
              : "Aucune"}
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Demandes</span>
          <strong className="profile-request-value">
            {exportData.contributions.total} total, {exportData.contributions.pending} en attente
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Dernière demande</span>
          <strong className="profile-request-value">
            {exportData.contributions.latestRequestAt
              ? formatDate(exportData.contributions.latestRequestAt)
              : "Aucune"}
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Historiques modérés</span>
          <strong className="profile-request-value">
            {exportData.moderationTrace.changeHistoriesAsModerator}
          </strong>
        </div>
        <div className="profile-request-change">
          <span>Actions admin</span>
          <strong className="profile-request-value">
            {exportData.moderationTrace.adminActionsAsActor}
          </strong>
        </div>
      </div>
      <div className="profile-export-identities">
        {exportData.linkedIdentities.map((identity) => (
          <div key={identity.id} className="profile-export-identity">
            <div className="admin-rgpd-identity-header">
              <strong>{providerLabels[identity.provider]}</strong>
              <button
                type="button"
                className="ghost-button danger-action"
                disabled={isLoading}
                onClick={() => {
                  onUnlinkIdentity(exportData.user, identity.provider);
                }}
              >
                Dissocier
              </button>
            </div>
            <span>{identity.providerEmail ?? identity.providerDisplayName ?? "Identité liée"}</span>
            <small>
              Lié le {formatDate(identity.connectedAt)}
              {identity.lastUsedAt ? ` · Utilisé le ${formatDate(identity.lastUsedAt)}` : ""}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
