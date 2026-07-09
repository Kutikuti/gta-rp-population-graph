import type { AdminUser, AdminUserPersonalDataExport } from "../api";
import { formatDate } from "../utils/format";
import { AdminRgpdPanel } from "./AdminRgpdPanel";
import { roleLabels } from "./admin-shared";

type AdminUsersPanelProps = {
  banReasons: Record<string, string>;
  isLoading: boolean;
  isPersonalDataLoading: boolean;
  personalDataExport: AdminUserPersonalDataExport | null;
  users: AdminUser[];
  onAnonymizeUser: (user: AdminUser) => void;
  onBanReasonChange: (userId: string, value: string) => void;
  onBanUser: (user: AdminUser) => void;
  onLoadPersonalData: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onUnlinkIdentity: (
    user: AdminUser,
    provider: AdminUserPersonalDataExport["linkedIdentities"][number]["provider"]
  ) => void;
  onRevokeBan: (user: AdminUser) => void;
  onUpdateRole: (user: AdminUser, roleName: AdminUser["role"]["name"]) => void;
};

const anonymizedEmailPattern = /^deleted-[\w-]+@deleted\.local$/;

const isAnonymizedUser = (user: AdminUser) =>
  user.displayName === "Utilisateur supprimé" || anonymizedEmailPattern.test(user.email);

export function AdminUsersPanel({
  banReasons,
  isLoading,
  isPersonalDataLoading,
  personalDataExport,
  users,
  onAnonymizeUser,
  onBanReasonChange,
  onBanUser,
  onLoadPersonalData,
  onRevokeSessions,
  onUnlinkIdentity,
  onRevokeBan,
  onUpdateRole
}: AdminUsersPanelProps) {
  return (
    <section className="work-panel admin-panel">
      <h3>Utilisateurs</h3>
      {isLoading && users.length === 0 ? <p className="muted-copy">Chargement...</p> : null}
      <div className="admin-list">
        {users.map((user) => (
          <article key={user.id} className="admin-row">
            <div>
              <strong>
                {user.displayName}
                {isAnonymizedUser(user) ? (
                  <span className="admin-status-chip">Compte anonymisé</span>
                ) : null}
              </strong>
              <small>{user.email}</small>
              <small>
                Créé le {formatDate(user.createdAt)}
                {user.isBanned ? " · banni" : ""}
              </small>
            </div>
            <div className="admin-row-actions">
              <select
                value={user.role.name}
                onChange={(event) => {
                  onUpdateRole(user, event.target.value as AdminUser["role"]["name"]);
                }}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {user.isBanned ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    onRevokeBan(user);
                  }}
                >
                  Lever
                </button>
              ) : (
                <>
                  <input
                    value={banReasons[user.id] ?? ""}
                    placeholder="Motif"
                    onChange={(event) => {
                      onBanReasonChange(user.id, event.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="ghost-button danger-action"
                    onClick={() => {
                      onBanUser(user);
                    }}
                  >
                    Bannir
                  </button>
                </>
              )}
              <button
                type="button"
                className="ghost-button"
                disabled={isPersonalDataLoading}
                onClick={() => {
                  onLoadPersonalData(user);
                }}
              >
                Données RGPD
              </button>
            </div>
          </article>
        ))}
      </div>
      {isPersonalDataLoading ? <p className="muted-copy">Chargement des données RGPD...</p> : null}
      {personalDataExport ? (
        <AdminRgpdPanel
          exportData={personalDataExport}
          isLoading={isPersonalDataLoading}
          onAnonymizeUser={onAnonymizeUser}
          onRevokeSessions={onRevokeSessions}
          onUnlinkIdentity={onUnlinkIdentity}
        />
      ) : null}
    </section>
  );
}
