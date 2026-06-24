import type { CharacterFilters, CharacterSnapshot, LifeStatus, VerificationStatus } from "./api";

export const initialFilters: CharacterFilters = {
  q: "",
  lifeStatus: "",
  tag: "",
  streamer: "",
  verificationStatus: ""
};

export const lifeStatusLabels: Record<LifeStatus, string> = {
  alive: "Vivant",
  deceased: "Décédé",
  left: "Parti",
  unknown: "Inconnu"
};

export const verificationLabels: Record<VerificationStatus, string> = {
  verified: "Vérifié",
  community: "Communautaire",
  imported: "Importé",
  to_check: "À vérifier",
  disputed: "Contesté"
};

export const relationLabels: Record<string, string> = {
  parent: "Parent",
  child: "Enfant",
  sibling: "Fratrie",
  couple: "Couple",
  previous_character: "Ancien personnage",
  couple_reference: "Couple",
  aunt_or_uncle_reference: "Oncle ou tante",
  ex_partner_reference: "Ex",
  uncle_reference: "Oncle",
  aunt_reference: "Tante"
};

export const editableRelationTypes = ["parent", "child", "sibling", "couple"] as const;

export const characterSnapshotFieldLabels: Record<keyof CharacterSnapshot, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  nickname: "Surnom",
  birthDate: "Date de naissance",
  lifeStatus: "Statut vital",
  deathOrDepartureDate: "Date de décès ou départ",
  photoUrl: "Photo",
  businessName: "Entreprise",
  businessRank: "Échelon entreprise",
  businessBadgeNumber: "Matricule entreprise",
  phoneNumber: "Téléphone",
  streamerId: "Streamer",
  streamerName: "Nouveau streamer",
  socialLinks: "Réseaux sociaux",
  groupName: "Groupe",
  groupRole: "Rôle groupe",
  district: "Quartier",
  isRpDeath: "Mort RP",
  relationships: "Parentés RP",
  policeRank: "Grade police",
  policeBadgeNumber: "Matricule police",
  previousCharacters: "Anciens personnages",
  verificationStatus: "Vérification",
  sourceNote: "Note de source"
};

export const isActiveFilters = (filters: CharacterFilters) =>
  Boolean(
    filters.q || filters.lifeStatus || filters.tag || filters.streamer || filters.verificationStatus
  );
