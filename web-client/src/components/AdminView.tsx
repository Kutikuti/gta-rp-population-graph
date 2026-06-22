import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminDashboard,
  type AdminTag,
  type AdminTagInput,
  type AdminUser,
  ApiRequestError,
  type AuthSession,
  banAdminUser,
  createAdminTag,
  deleteAdminTag,
  getAdminDashboard,
  revokeAdminUserBan,
  updateAdminTag,
  updateAdminUserRole
} from "../api";
import { formatDate, formatDateTime } from "../utils/format";

type AdminViewProps = {
  session: AuthSession | null;
  onError: (message: string) => void;
};

const emptyTagInput: AdminTagInput = {
  name: "",
  type: null,
  colorHex: "#2f9bff",
  description: null
};

const roleLabels = {
  user: "Utilisateur",
  moderator: "Modérateur",
  administrator: "Administrateur"
} as const;

const tagTypeLabels = {
  family: "Famille",
  district: "Quartier",
  organization: "Organisation",
  business: "Entreprise",
  other: "Autre"
} as const;

const actionLabels: Record<string, string> = {
  "tag.create": "Tag créé",
  "tag.update": "Tag modifié",
  "tag.delete": "Tag supprimé",
  "user.role.update": "Rôle modifié",
  "user.ban": "Utilisateur banni",
  "user.ban.revoke": "Bannissement levé"
};

const tagInputFromTag = (tag: AdminTag): AdminTagInput => ({
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description
});

const normalizeTagInput = (input: AdminTagInput): AdminTagInput => ({
  name: input.name.trim(),
  type: input.type,
  colorHex: input.colorHex,
  description: input.description?.trim() ? input.description.trim() : null
});

const adminErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return "L'action d'administration a échoué.";
  }

  switch (error.code) {
    case "VALIDATION_ERROR":
      return "Les données saisies sont invalides. Vérifie les champs du formulaire.";
    case "TAG_IN_USE":
      return "Ce tag est encore utilisé par des fiches et ne peut pas être supprimé.";
    case "LAST_ADMIN":
      return "Impossible de retirer le dernier administrateur actif.";
    case "TAG_NOT_FOUND":
      return "Ce tag n'existe plus ou a déjà été supprimé.";
    case "USER_NOT_FOUND":
      return "Cet utilisateur n'existe plus ou n'est plus disponible.";
    default:
      return error.message || "L'action d'administration a échoué.";
  }
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
        <section className="work-panel admin-panel">
          <h3>Utilisateurs</h3>
          {isLoading && !dashboard ? <p className="muted-copy">Chargement...</p> : null}
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
                      void runAction(
                        () =>
                          updateAdminUserRole(
                            user.id,
                            event.target.value as AdminUser["role"]["name"]
                          ),
                        "Rôle mis à jour."
                      );
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
                        void runAction(() => revokeAdminUserBan(user.id), "Bannissement levé.");
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
                          setBanReasons((current) => ({
                            ...current,
                            [user.id]: event.target.value
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="ghost-button danger-action"
                        onClick={() => {
                          const reason = banReasons[user.id]?.trim();

                          if (!reason) {
                            onError("Un motif de bannissement est requis.");
                            return;
                          }

                          void runAction(() => banAdminUser(user.id, reason), "Utilisateur banni.");
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

        <section className="work-panel admin-panel">
          <h3>Tags</h3>
          <form className="admin-form" onSubmit={submitTag}>
            <label>
              Nom
              <input
                value={tagInput.name}
                onChange={(event) => {
                  setTagInput((current) => ({ ...current, name: event.target.value }));
                }}
              />
            </label>
            <label>
              Type
              <select
                value={tagInput.type ?? ""}
                onChange={(event) => {
                  setTagInput((current) => ({
                    ...current,
                    type: event.target.value ? (event.target.value as AdminTag["type"]) : null
                  }));
                }}
              >
                <option value="">Aucun</option>
                {Object.entries(tagTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Couleur
              <input
                type="color"
                value={tagInput.colorHex}
                onChange={(event) => {
                  setTagInput((current) => ({ ...current, colorHex: event.target.value }));
                }}
              />
            </label>
            <label>
              Description
              <textarea
                value={tagInput.description ?? ""}
                onChange={(event) => {
                  setTagInput((current) => ({ ...current, description: event.target.value }));
                }}
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-action">
                {editingTag ? "Modifier le tag" : "Créer le tag"}
              </button>
              {editingTag ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingTagId(null);
                    setTagInput(emptyTagInput);
                  }}
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
          <div className="admin-list">
            {tags.map((tag) => (
              <article key={tag.id} className="admin-row">
                <div>
                  <strong>
                    <span className="tag-color-swatch" style={{ background: tag.colorHex }} />
                    {tag.name}
                  </strong>
                  <small>{tag.type ? tagTypeLabels[tag.type] : "Sans type"}</small>
                  <small>{tag.usageCount} fiche(s)</small>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setEditingTagId(tag.id);
                      setTagInput(tagInputFromTag(tag));
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="ghost-button danger-action"
                    disabled={tag.usageCount > 0}
                    onClick={() => {
                      void runAction(() => deleteAdminTag(tag.id), "Tag supprimé.");
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

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
      </div>
    </section>
  );
}
