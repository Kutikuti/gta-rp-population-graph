import type { AuthSession } from "../api";

type AuthControlsProps = {
  isLoading: boolean;
  session: AuthSession | null;
  loginHref: string;
  onLogout: () => void;
};

const roleLabels = {
  user: "Utilisateur",
  moderator: "Modérateur",
  administrator: "Administrateur"
} as const;

const initialsFromName = (displayName: string) =>
  displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function AuthControls({ isLoading, session, loginHref, onLogout }: AuthControlsProps) {
  if (isLoading) {
    return (
      <div className="auth-controls">
        <span className="auth-status auth-status-muted">Connexion...</span>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="auth-controls">
        <a href={loginHref} className="ghost-button auth-button auth-link">
          Connexion Google
        </a>
      </div>
    );
  }

  return (
    <div className="auth-controls">
      <div className="auth-user-card">
        {session.user.avatarUrl ? (
          <img
            src={session.user.avatarUrl}
            alt=""
            className="auth-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="auth-avatar auth-avatar-fallback" aria-hidden="true">
            {initialsFromName(session.user.displayName)}
          </span>
        )}
        <div className="auth-user-copy">
          <strong>{session.user.displayName}</strong>
          <small>{roleLabels[session.user.role.name]}</small>
        </div>
      </div>
      <button type="button" className="ghost-button auth-button" onClick={onLogout}>
        Déconnexion
      </button>
    </div>
  );
}
