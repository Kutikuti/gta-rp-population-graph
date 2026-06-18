import { useEffect, useState } from "react";

import { type AuthSession, getAuthSession, logout } from "../api";

export type AuthFeedback = {
  tone: "success" | "error";
  message: string;
};

const authErrorMessages: Record<string, string> = {
  access_denied: "Connexion Google annulée.",
  banned: "Ce compte n'est pas autorisé à contribuer.",
  invalid_state: "La vérification de connexion a expiré. Réessaie.",
  oauth_disabled: "La connexion Google n'est pas disponible.",
  oauth_exchange_failed: "La connexion Google n'a pas pu aboutir."
};

const readAuthRedirectResult = () => {
  const url = new URL(window.location.href);
  const auth = url.searchParams.get("auth");
  const authError = url.searchParams.get("auth_error");

  if (!auth && !authError) {
    return null;
  }

  url.searchParams.delete("auth");
  url.searchParams.delete("auth_error");
  window.history.replaceState({}, "", url.toString());

  return authError ?? auth;
};

export function useAuthSession(onError: (message: string) => void) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [authRedirectResult, setAuthRedirectResult] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    setAuthRedirectResult(readAuthRedirectResult());
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadAuthSession = async () => {
      try {
        const session = await getAuthSession();

        if (!ignore) {
          setAuthSession(session);
        }
      } catch {
        if (!ignore) {
          setAuthSession({ authenticated: false });
        }
      } finally {
        if (!ignore) {
          setIsAuthLoading(false);
        }
      }
    };

    void loadAuthSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!authRedirectResult || isAuthLoading) {
      return;
    }

    if (authRedirectResult === "success") {
      setAuthFeedback(
        authSession?.authenticated
          ? { tone: "success", message: "Connexion établie." }
          : { tone: "error", message: "La session n'a pas pu être confirmée." }
      );
      setAuthRedirectResult(null);
      return;
    }

    setAuthFeedback({
      tone: "error",
      message: authErrorMessages[authRedirectResult] ?? "La connexion Google n'a pas pu aboutir."
    });
    setAuthRedirectResult(null);
  }, [authRedirectResult, authSession, isAuthLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      setAuthSession({ authenticated: false });
      setAuthFeedback({ tone: "success", message: "Déconnexion effectuée." });
    } catch {
      onError("La déconnexion n'a pas pu aboutir.");
    }
  };

  return {
    authFeedback,
    authSession,
    handleLogout,
    isAuthLoading
  };
}
