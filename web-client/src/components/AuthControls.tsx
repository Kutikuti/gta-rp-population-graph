import { useEffect, useRef, useState } from "react";

import type { AuthSession } from "../api";

type AuthControlsProps = {
  activeView: "explore" | "contribution" | "moderation" | "administration" | "imports" | "profile";
  isLoading: boolean;
  session: AuthSession | null;
  loginOptions: Array<{
    label: string;
    href: string;
  }>;
  onLogout: () => void;
  onProfile: () => void;
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

export function AuthControls({
  activeView,
  isLoading,
  session,
  loginOptions,
  onLogout,
  onProfile
}: AuthControlsProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const loginPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLoginOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        loginPanelRef.current &&
        !loginPanelRef.current.contains(event.target)
      ) {
        setIsLoginOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLoginOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isLoginOpen]);

  if (isLoading) {
    return (
      <div className="auth-controls">
        <span className="auth-status auth-status-muted">Connexion...</span>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="auth-controls auth-login-menu" ref={loginPanelRef}>
        <button
          type="button"
          className={`ghost-button auth-button ${isLoginOpen ? "is-active" : ""}`}
          aria-expanded={isLoginOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setIsLoginOpen((current) => !current);
          }}
        >
          Connexion
        </button>
        {isLoginOpen ? (
          <div className="auth-login-popover" role="dialog" aria-label="Choisir une connexion">
            <div className="auth-login-popover-header">
              <strong>Connexion</strong>
              <button
                type="button"
                className="auth-login-close"
                aria-label="Fermer la connexion"
                onClick={() => {
                  setIsLoginOpen(false);
                }}
              >
                ×
              </button>
            </div>
            <div className="auth-provider-list">
              {loginOptions.map((option) => (
                <a key={option.label} href={option.href} className="auth-provider-link auth-link">
                  <span className="auth-provider-mark" aria-hidden="true">
                    {option.label.slice(0, 1)}
                  </span>
                  <span>Continuer avec {option.label}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="auth-controls">
      <button
        type="button"
        className={`auth-user-card ${activeView === "profile" ? "is-active" : ""}`}
        onClick={onProfile}
      >
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
      </button>
      <button type="button" className="ghost-button auth-button" onClick={onLogout}>
        Déconnexion
      </button>
    </div>
  );
}
