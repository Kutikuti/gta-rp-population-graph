import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type AuthSession,
  getAuthSession,
  logout,
  unlinkProfileIdentity,
  updateProfileDisplayName
} from "../api";

export type AuthFeedback = {
  tone: "success" | "error";
  message: string;
};

const authErrorMessages: Record<string, string> = {
  access_denied: "Connexion annulée.",
  banned: "Ton compte a été banni.",
  different_identity_already_linked: "Un autre compte de ce fournisseur est déjà lié à ton profil.",
  identity_email_in_use:
    "Un compte existe déjà avec cette adresse email. Connecte-toi d'abord avec ton fournisseur déjà lié pour rattacher ce nouveau compte depuis le profil.",
  identity_in_use: "Ce compte est déjà lié à un autre utilisateur.",
  identity_link_failed: "Le rattachement du compte n'a pas pu aboutir.",
  invalid_state: "La vérification de connexion a expiré. Réessaie.",
  oauth_disabled: "Cette connexion n'est pas disponible.",
  oauth_exchange_failed: "La connexion n'a pas pu aboutir."
};

const readAuthRedirectResult = () => {
  const url = new URL(window.location.href);
  const auth = url.searchParams.get("auth");
  const authError = url.searchParams.get("auth_error");

  return authError ?? auth;
};

const clearAuthRedirectResult = () => {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("auth") && !url.searchParams.has("auth_error")) {
    return;
  }

  url.searchParams.delete("auth");
  url.searchParams.delete("auth_error");
  window.history.replaceState({}, "", url.toString());
};

export function useAuthSession(onError: (message: string) => void) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [authRedirectResult, setAuthRedirectResult] = useState<string | null>(
    readAuthRedirectResult
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (authRedirectResult) {
      clearAuthRedirectResult();
    }
  }, [authRedirectResult]);

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

    if (
      authRedirectResult === "identity_linked" ||
      authRedirectResult === "identity_already_linked"
    ) {
      setAuthFeedback({
        tone: "success",
        message:
          authRedirectResult === "identity_linked"
            ? "Compte lié."
            : "Ce compte est déjà lié à ton profil."
      });
      setAuthRedirectResult(null);
      void getAuthSession()
        .then((session) => {
          setAuthSession(session);
        })
        .catch(() => {
          setAuthSession({ authenticated: false });
        });
      return;
    }

    setAuthFeedback({
      tone: "error",
      message: authErrorMessages[authRedirectResult] ?? "La connexion n'a pas pu aboutir."
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

  const handleDisplayNameUpdate = async (displayName: string) => {
    try {
      const { user } = await updateProfileDisplayName(displayName);
      setAuthSession({ authenticated: true, user });
      setAuthFeedback({ tone: "success", message: "Nom public mis à jour." });
      return true;
    } catch {
      onError("Le nom public n'a pas pu être mis à jour.");
      return false;
    }
  };

  const handleIdentityUnlink = async (provider: "google" | "discord" | "twitch") => {
    try {
      const { user } = await unlinkProfileIdentity(provider);
      setAuthSession({ authenticated: true, user });
      setAuthFeedback({ tone: "success", message: "Compte lié dissocié." });
      return true;
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.code === "LAST_IDENTITY"
          ? error.message
          : error instanceof ApiRequestError && error.code === "IDENTITY_NOT_FOUND"
            ? "Ce compte lié n'est plus disponible."
            : error instanceof Error &&
                error.message === "Impossible de dissocier le dernier moyen de connexion."
              ? error.message
              : "Le compte lié n'a pas pu être dissocié.";
      onError(message);
      return false;
    }
  };

  return {
    authFeedback,
    authSession,
    handleDisplayNameUpdate,
    handleIdentityUnlink,
    handleLogout,
    isAuthLoading
  };
}
