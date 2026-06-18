import { type AuthSession, getGoogleAuthUrl } from "../api";
import { AuthControls } from "./AuthControls";

type AppHeaderProps = {
  authFeedback: {
    tone: "success" | "error";
    message: string;
  } | null;
  authSession: AuthSession | null;
  isAuthLoading: boolean;
  onLogout: () => void;
};

export function AppHeader({ authFeedback, authSession, isAuthLoading, onLogout }: AppHeaderProps) {
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
        <AuthControls
          isLoading={isAuthLoading}
          session={authSession}
          loginHref={getGoogleAuthUrl()}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
