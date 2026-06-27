import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminDashboard,
  type AdminTagInput,
  type AuthSession,
  banAdminUser,
  createAdminTag,
  deleteAdminTag,
  getAdminDashboard,
  revokeAdminUserBan,
  updateAdminTag,
  updateAdminUserRole
} from "../api";
import { AdminActionsPanel } from "./AdminActionsPanel";
import { AdminTagsPanel } from "./AdminTagsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import {
  adminErrorMessage,
  emptyTagInput,
  normalizeTagInput,
  tagInputFromTag
} from "./admin-shared";

type AdminViewProps = {
  session: AuthSession | null;
  onError: (message: string) => void;
};

export function AdminView({ session, onError }: AdminViewProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [tagInput, setTagInput] = useState<AdminTagInput>(emptyTagInput);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canAdmin = session?.authenticated && session.user.role.name === "administrator";
  const editingTag = useMemo(
    () => dashboard?.tags.find((tag) => tag.id === editingTagId) ?? null,
    [dashboard, editingTagId]
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      setDashboard(await getAdminDashboard());
    } catch {
      onError("L'administration n'a pas pu être chargée.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (canAdmin) {
      void loadDashboard();
    }
  }, [canAdmin, loadDashboard]);

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

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      await loadDashboard();
      setFeedback(message);
    } catch (error) {
      onError(adminErrorMessage(error));
    }
  };

  const submitTag = async (event: FormEvent) => {
    event.preventDefault();
    const input = normalizeTagInput(tagInput);

    await runAction(
      () => (editingTag ? updateAdminTag(editingTag.id, input) : createAdminTag(input)),
      editingTag ? "Tag modifié." : "Tag créé."
    );
    setTagInput(emptyTagInput);
    setEditingTagId(null);
  };

  const users = dashboard?.users ?? [];
  const tags = dashboard?.tags ?? [];
  const actions = dashboard?.actions ?? [];

  return (
    <section className="full-page-view" aria-labelledby="admin-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h2 id="admin-title">Contrôle des données et accès</h2>
        </div>
        {feedback ? <p className="auth-feedback auth-feedback-success">{feedback}</p> : null}
      </div>

      <div className="admin-layout">
        <AdminUsersPanel
          banReasons={banReasons}
          isLoading={isLoading}
          users={users}
          onBanReasonChange={(userId, value) => {
            setBanReasons((current) => ({
              ...current,
              [userId]: value
            }));
          }}
          onBanUser={(user) => {
            const reason = banReasons[user.id]?.trim();

            if (!reason) {
              onError("Un motif de bannissement est requis.");
              return;
            }

            void runAction(() => banAdminUser(user.id, reason), "Utilisateur banni.");
          }}
          onRevokeBan={(user) => {
            void runAction(() => revokeAdminUserBan(user.id), "Bannissement levé.");
          }}
          onUpdateRole={(user, roleName) => {
            void runAction(() => updateAdminUserRole(user.id, roleName), "Rôle mis à jour.");
          }}
        />

        <AdminTagsPanel
          editingTag={editingTag}
          tagInput={tagInput}
          tags={tags}
          onCancelEdit={() => {
            setEditingTagId(null);
            setTagInput(emptyTagInput);
          }}
          onDeleteTag={(tag) => {
            void runAction(() => deleteAdminTag(tag.id), "Tag supprimé.");
          }}
          onEditTag={(tag) => {
            setEditingTagId(tag.id);
            setTagInput(tagInputFromTag(tag));
          }}
          onSubmit={submitTag}
          onTagInputChange={setTagInput}
        />

        <AdminActionsPanel actions={actions} />
      </div>
    </section>
  );
}
