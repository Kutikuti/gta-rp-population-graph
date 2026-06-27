import type { AdminTag, AdminTagInput } from "../api";
import { apiErrorMessage } from "./api-error-shared";

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
  return apiErrorMessage(error, "L'action d'administration a échoué.", {
    VALIDATION_ERROR: "Les données saisies sont invalides. Vérifie les champs du formulaire.",
    TAG_IN_USE: "Ce tag est encore utilisé par des fiches et ne peut pas être supprimé.",
    LAST_ADMIN: "Impossible de retirer le dernier administrateur actif.",
    TAG_NOT_FOUND: "Ce tag n'existe plus ou a déjà été supprimé.",
    USER_NOT_FOUND: "Cet utilisateur n'existe plus ou n'est plus disponible."
  });
};
