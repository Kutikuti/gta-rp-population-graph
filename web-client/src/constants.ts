import type { CharacterFilters, LifeStatus, VerificationStatus } from "./api";

export const initialFilters: CharacterFilters = {
  q: "",
  lifeStatus: "",
  tag: "",
  streamer: "",
  verificationStatus: ""
};

export const lifeStatusLabels: Record<LifeStatus, string> = {
  alive: "Vivant",
  deceased: "Decede",
  left: "Parti",
  unknown: "Inconnu"
};

export const verificationLabels: Record<VerificationStatus, string> = {
  verified: "Verifie",
  community: "Communautaire",
  imported: "Importe",
  to_check: "A verifier",
  disputed: "Conteste"
};

export const relationLabels: Record<string, string> = {
  parent: "Parent",
  child: "Enfant",
  sibling: "Fratrie",
  couple: "Couple"
};

export const isActiveFilters = (filters: CharacterFilters) =>
  Boolean(
    filters.q || filters.lifeStatus || filters.tag || filters.streamer || filters.verificationStatus
  );
