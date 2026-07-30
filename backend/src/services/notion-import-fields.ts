export const fieldAliases = {
  firstName: ["prenom", "prénom", "firstName", "first_name", "first name"],
  lastName: ["nom", "lastName", "last_name", "last name"],
  nickname: ["surnom", "nickname", "alias"],
  lifeStatus: ["statut", "statut vital", "lifeStatus", "life_status"],
  deathOrDepartureDate: [
    "date",
    "date de mort",
    "date de mort rp",
    "date de décès",
    "date de deces",
    "date de départ",
    "date de depart",
    "deathOrDepartureDate",
    "death_or_departure_date"
  ],
  phoneNumber: ["telephone", "téléphone", "phone", "phoneNumber", "phone_number"],
  streamerPublicName: ["streamer", "streameur", "streamerPublicName"],
  companyName: ["métier/entreprise", "metier/entreprise", "entreprise", "businessName"],
  companyRank: ["grade", "poste", "rang", "companyRank", "businessRank"],
  companyBadgeNumber: ["matricule", "companyBadgeNumber", "businessBadgeNumber"],
  groupName: ["groupes", "groupe", "groupName"],
  district: ["quartier", "district"],
  twitch: ["twitch"],
  kick: ["kick"],
  youtube: ["youtube", "youTube"],
  discord: ["discord"],
  instagram: ["instagram"],
  tiktok: ["tiktok", "tikTok"],
  previousCharacters: [
    "anciens personnages",
    "previousCharacters",
    "previous_characters",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5"
  ],
  legacyCharacterLinks: ["v6"],
  parentRelationships: ["père relation", "pere relation", "mère relation", "mere relation"],
  parentIndicator: ["est parent"],
  siblingRelationships: [
    "frères/soeurs relation",
    "freres/soeurs relation",
    "frères/soeurs relations",
    "freres/soeurs relations",
    "frères/sœurs relation",
    "freres/sœurs relation",
    "frères/sœurs relations",
    "freres/sœurs relations"
  ],
  informativeCoupleRelationships: ["couple relation"],
  informativeAuntOrUncleRelationships: ["est oncle/tante"],
  informativeExRelationships: ["ex/exs relation"],
  informativeUncleRelationships: ["oncle relation"],
  informativeAuntRelationships: ["tante relation"],
  familyName: ["famille"],
  tags: ["tags", "tag"],
  relationships: ["relations", "relationships", "parentes rp", "parentés rp"],
  photoReferences: ["photo", "image", "avatar", "photoUrl", "photo_url"]
} as const;

const allAliases = new Set(
  Object.values(fieldAliases)
    .flat()
    .map((value) => value.toLowerCase())
);
const technicalImportFields = new Set(["titre notion"]);

const normalizeKey = (value: string) => value.trim().toLowerCase();

export const recognizedFieldNames = (properties: Record<string, unknown>) =>
  Object.keys(properties)
    .filter((key) => allAliases.has(normalizeKey(key)))
    .sort();

export const unknownFieldNames = (properties: Record<string, unknown>) =>
  Object.keys(properties)
    .filter((key) => {
      const normalizedKey = normalizeKey(key);
      return !allAliases.has(normalizedKey) && !technicalImportFields.has(normalizedKey);
    })
    .sort();
