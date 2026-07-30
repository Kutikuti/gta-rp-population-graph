import type { CharacterFilters, CharacterSnapshot, LifeStatus, VerificationStatus } from "./api";

export const initialFilters: CharacterFilters = {
  q: "",
  company: "",
  lifeStatus: "",
  tag: "",
  streamer: "",
  twitchLive: "",
  verificationStatus: ""
};

export const lifeStatusLabels: Record<LifeStatus, string> = {
  alive: "Vivant",
  deceased: "Décédé",
  left: "Parti",
  unknown: "Inconnu"
} satisfies Record<LifeStatus, string>;

export const verificationLabels: Record<VerificationStatus, string> = {
  verified: "Vérifié",
  community: "Communautaire",
  imported: "Importé",
  to_check: "À vérifier",
  disputed: "Contesté"
} satisfies Record<VerificationStatus, string>;

export const relationLabels: Record<string, string> = {
  parent: "Parent",
  child: "Enfant",
  sibling: "Fratrie",
  couple: "Couple",
  previous_character: "Ancien personnage",
  ex_partner_reference: "Ex",
  uncle_reference: "Oncle",
  aunt_reference: "Tante"
};

export const editableRelationTypes = [
  "parent",
  "child",
  "sibling",
  "couple",
  "previous_character",
  "ex_partner_reference",
  "uncle_reference",
  "aunt_reference"
] as const;

export const relationTypeGroups: Array<{
  label: string;
  types: (typeof editableRelationTypes)[number][];
}> = [
  {
    label: "Relations principales",
    types: ["parent", "child", "sibling", "couple"]
  },
  {
    label: "Relations complémentaires",
    types: ["previous_character", "ex_partner_reference", "uncle_reference", "aunt_reference"]
  }
];

export const characterSnapshotFieldLabels: Record<keyof CharacterSnapshot, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  nickname: "Surnom",
  birthDate: "Date de naissance",
  lifeStatus: "Statut vital",
  deathOrDepartureDate: "Date de décès ou départ",
  photoUrl: "Photo",
  companyName: "Entreprise",
  companyRank: "Grade",
  companyBadgeNumber: "Matricule",
  phoneNumbers: "Téléphones",
  streamerId: "Streamer",
  streamerName: "Nouveau streamer",
  socialLinks: "Réseaux sociaux",
  groupName: "Groupe",
  district: "Quartier",
  isRpDeath: "Mort RP",
  relationships: "Parentés RP",
  previousCharacters: "Anciens personnages",
  verificationStatus: "Vérification",
  sourceNote: "Note de source"
} satisfies Record<keyof CharacterSnapshot, string>;

export const isActiveFilters = (filters: CharacterFilters) =>
  Boolean(
    filters.q ||
      filters.company ||
      filters.lifeStatus ||
      filters.tag ||
      filters.streamer ||
      filters.twitchLive ||
      filters.verificationStatus
  );
