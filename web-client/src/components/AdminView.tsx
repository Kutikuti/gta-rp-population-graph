import type { AuthSession } from "../api";
import { useAdminViewState } from "../hooks/useAdminViewState";
import { AdminActionsPanel } from "./AdminActionsPanel";
import { AdminAnonymizationDialog } from "./AdminAnonymizationDialog";
import { AdminTagsPanel } from "./AdminTagsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { DataCompletenessPanel } from "./DataCompletenessPanel";

type AdminViewProps = {
  session: AuthSession | null;
  onError: (message: string) => void;
  onEditCharacter: (slug: string) => void;
};

export function AdminView({ session, onEditCharacter, onError }: AdminViewProps) {
  const canAdmin = session?.authenticated && session.user.role.name === "administrator";
  const adminState = useAdminViewState({ canAdmin: Boolean(canAdmin), onError });

  if (!session?.authenticated) {
    return (
      <section className="full-page-view" aria-labelledby="admin-title">
        <div className="full-page-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h2 id="admin-title">Connexion requise</h2>
          </div>
        </div>
      </section>
    );
  }

  if (!canAdmin) {
    return (
      <section className="full-page-view" aria-labelledby="admin-title">
        <div className="full-page-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h2 id="admin-title">Accès refusé</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="full-page-view" aria-labelledby="admin-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h2 id="admin-title">Contrôle des données et accès</h2>
        </div>
        {adminState.feedback ? (
          <p className="auth-feedback auth-feedback-success">{adminState.feedback}</p>
        ) : null}
      </div>

      <div className="admin-page-content">
        <DataCompletenessPanel
          isLoading={adminState.isCompletenessLoading}
          onEditCharacter={onEditCharacter}
          report={adminState.completenessReport}
          title="Fiches à compléter"
        />

        <div className="admin-layout">
          <AdminUsersPanel
            banReasons={adminState.banReasons}
            isLoading={adminState.isLoading}
            isPersonalDataLoading={adminState.isPersonalDataLoading}
            personalDataExport={adminState.personalDataExport}
            users={adminState.users}
            onBanReasonChange={adminState.updateBanReason}
            onBanUser={adminState.banUser}
            onLoadPersonalData={(user) => {
              void adminState.loadPersonalDataExport(user);
            }}
            onRevokeSessions={(user) => {
              void adminState.revokeUserSessions(user);
            }}
            onUnlinkIdentity={(user, provider) => {
              void adminState.unlinkUserIdentity(user, provider);
            }}
            onAnonymizeUser={(user) => {
              adminState.setAnonymizationCandidate(user);
            }}
            onRevokeBan={(user) => {
              adminState.revokeBan(user.id);
            }}
            onUpdateRole={(user, roleName) => {
              adminState.updateUserRole(user.id, roleName);
            }}
          />

          <AdminTagsPanel
            editingTag={adminState.editingTag}
            tagInput={adminState.tagInput}
            tags={adminState.tags}
            onCancelEdit={adminState.cancelTagEdit}
            onDeleteTag={(tag) => {
              adminState.deleteTag(tag.id);
            }}
            onEditTag={adminState.editTag}
            onSubmit={adminState.submitTag}
            onTagInputChange={adminState.setTagInput}
          />

          <AdminActionsPanel actions={adminState.actions} />
        </div>
      </div>
      {adminState.anonymizationCandidate ? (
        <AdminAnonymizationDialog
          user={adminState.anonymizationCandidate}
          onCancel={() => {
            adminState.setAnonymizationCandidate(null);
          }}
          onConfirm={(user) => {
            void adminState.anonymizeUserAccount(user);
          }}
        />
      ) : null}
    </section>
  );
}
