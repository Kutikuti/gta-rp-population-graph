import type { AdminTag, AdminTagInput } from "../api";
import { ApiRequestError } from "../api";

export const emptyTagInput: AdminTagInput = {
  name: "",
  type: null,
  colorHex: "#2f9bff",
  description: null
};

export const roleLabels = {
  user: "Utilisateur",
  moderator: "Modérateur",
  administrator: "Administrateur"
} as const;

export const tagTypeLabels = {
  family: "Famille",
  district: "Quartier",
  organization: "Organisation",
  business: "Entreprise",
  other: "Autre"
} as const;

export const actionLabels: Record<string, string> = {
  "tag.create": "Tag créé",
  "tag.update": "Tag modifié",
  "tag.delete": "Tag supprimé",
  "user.role.update": "Rôle modifié",
  "user.ban": "Utilisateur banni",
  "user.ban.revoke": "Bannissement levé"
};

export const tagInputFromTag = (tag: AdminTag): AdminTagInput => ({
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description
});

export const normalizeTagInput = (input: AdminTagInput): AdminTagInput => ({
  name: input.name.trim(),
  type: input.type,
  colorHex: input.colorHex,
  description: input.description?.trim() ? input.description.trim() : null
});

export const adminErrorMessage = (error: unknown) => {
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
