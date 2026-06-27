import type { AdminDashboard } from "../api";
import { formatDateTime } from "../utils/format";
import { actionLabels } from "./admin-shared";

type AdminActionsPanelProps = {
  actions: AdminDashboard["actions"];
};

export function AdminActionsPanel({ actions }: AdminActionsPanelProps) {
  return (
    <section className="work-panel admin-panel admin-log-panel">
      <h3>Journal</h3>
      <div className="admin-list">
        {actions.map((action) => (
          <article key={action.id} className="admin-row">
            <div>
              <strong>{actionLabels[action.action] ?? action.action}</strong>
              <small>
                {action.actor?.displayName ?? "Système"}
                {action.targetUser ? ` -> ${action.targetUser.displayName}` : ""}
              </small>
              <small>{formatDateTime(action.createdAt)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
