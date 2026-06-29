import { type AuthSession, getDiscordAuthUrl, getGoogleAuthUrl } from "../api";
import { AuthControls } from "./AuthControls";

type AppHeaderProps = {
  authFeedback: {
    tone: "success" | "error";
    message: string;
  } | null;
  authSession: AuthSession | null;
  activeView: "explore" | "contribution" | "moderation" | "administration" | "imports" | "profile";
  isAuthLoading: boolean;
  onAdministration: () => void;
  onExplore: () => void;
  onImports: () => void;
  onLogout: () => void;
  onModeration: () => void;
  onProfile: () => void;
};

const canModerate = (session: AuthSession | null) =>
  session?.authenticated &&
  (session.user.role.name === "moderator" || session.user.role.name === "administrator");

const canAdmin = (session: AuthSession | null) =>
  session?.authenticated && session.user.role.name === "administrator";

export function AppHeader({
  authFeedback,
  authSession,
  activeView,
  isAuthLoading,
  onAdministration,
  onExplore,
  onImports,
  onLogout,
  onModeration,
  onProfile
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-content">
        <div className="topbar-copy">
          <p className="eyebrow">Annuaire RP public</p>
          <h1 id="workspace-title">GTA-RP Population Graph</h1>
          {authFeedback ? (
            <p className={`auth-feedback auth-feedback-${authFeedback.tone}`}>
              {authFeedback.message}
            </p>
          ) : null}
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`ghost-button ${activeView === "explore" ? "is-active" : ""}`}
            onClick={onExplore}
          >
            Graphe
          </button>
          {canModerate(authSession) ? (
            <button
              type="button"
              className={`ghost-button ${activeView === "moderation" ? "is-active" : ""}`}
              onClick={onModeration}
            >
              Modération
            </button>
          ) : null}
          {canAdmin(authSession) ? (
            <>
              <button
                type="button"
                className={`ghost-button ${activeView === "imports" ? "is-active" : ""}`}
                onClick={onImports}
              >
                Imports
              </button>
              <button
                type="button"
                className={`ghost-button ${activeView === "administration" ? "is-active" : ""}`}
                onClick={onAdministration}
              >
                Administration
              </button>
            </>
          ) : null}
          <AuthControls
            activeView={activeView}
            isLoading={isAuthLoading}
            session={authSession}
            loginOptions={[
              { label: "Google", href: getGoogleAuthUrl() },
              { label: "Discord", href: getDiscordAuthUrl() }
            ]}
            onLogout={onLogout}
            onProfile={onProfile}
          />
        </div>
      </div>
    </header>
  );
}
