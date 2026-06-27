import type { AdminUser } from "../api";
import { formatDate } from "../utils/format";
import { roleLabels } from "./admin-shared";

type AdminUsersPanelProps = {
  banReasons: Record<string, string>;
  isLoading: boolean;
  users: AdminUser[];
  onBanReasonChange: (userId: string, value: string) => void;
  onBanUser: (user: AdminUser) => void;
  onRevokeBan: (user: AdminUser) => void;
  onUpdateRole: (user: AdminUser, roleName: AdminUser["role"]["name"]) => void;
};

export function AdminUsersPanel({
  banReasons,
  isLoading,
  users,
  onBanReasonChange,
  onBanUser,
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
              <strong>{user.displayName}</strong>
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
