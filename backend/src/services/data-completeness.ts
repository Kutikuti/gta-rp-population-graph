import { models } from "../db/index.js";

type DataCompletenessItem = {
  id: string;
  publicSlug: string;
  fullName: string;
  verificationStatus: string;
  dataSource: string;
  missingFields: Array<{
    key: string;
    label: string;
  }>;
  attentionFlags: string[];
  updatedAt: string;
};

export type DataCompletenessReport = {
  summary: {
    total: number;
    withMissingFields: number;
    importedOrCommunity: number;
    needsReview: number;
  };
  items: DataCompletenessItem[];
};

export type DataCompletenessService = {
  getReport(): Promise<DataCompletenessReport>;
};

const completenessLabels = {
  birthDate: "Date de naissance",
  companyBadgeNumber: "Matricule",
  companyName: "Entreprise",
  companyRank: "Grade",
  lifeStatus: "Statut vital",
  nickname: "Surnom",
  phoneNumbers: "Téléphone",
  photoUrl: "Photo",
  sourceNote: "Note de source"
} as const;

const fullName = (character: { firstName: string; lastName: string }) =>
  `${character.firstName} ${character.lastName}`.trim();

const hasText = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;

const normalizedStringList = (values: string[]) =>
  values.map((value) => value.trim()).filter(Boolean);

const missingFieldsForCharacter = (character: {
  birthDate: string | null;
  companyBadgeNumber: string | null;
  companyName: string | null;
  companyRank: string | null;
  lifeStatus: string;
  phoneNumbers: string[];
  photoUrl: string | null;
}) => {
  const missingFields: DataCompletenessItem["missingFields"] = [];
  const phoneNumbers = normalizedStringList(character.phoneNumbers);
  const hasCompanyName = hasText(character.companyName);
  const hasCompanyRank = hasText(character.companyRank);
  const hasCompanyBadgeNumber = hasText(character.companyBadgeNumber);

  if (!hasText(character.birthDate)) {
    missingFields.push({ key: "birthDate", label: completenessLabels.birthDate });
  }

  if (character.lifeStatus === "unknown") {
    missingFields.push({ key: "lifeStatus", label: completenessLabels.lifeStatus });
  }

  if (!hasText(character.photoUrl)) {
    missingFields.push({ key: "photoUrl", label: completenessLabels.photoUrl });
  }

  if (phoneNumbers.length === 0) {
    missingFields.push({ key: "phoneNumbers", label: completenessLabels.phoneNumbers });
  }

  if (hasCompanyName && !hasCompanyRank) {
    missingFields.push({ key: "companyRank", label: completenessLabels.companyRank });
  }

  if (hasCompanyName && !hasCompanyBadgeNumber) {
    missingFields.push({
      key: "companyBadgeNumber",
      label: completenessLabels.companyBadgeNumber
    });
  }

  if ((hasCompanyRank || hasCompanyBadgeNumber) && !hasCompanyName) {
    missingFields.push({ key: "companyName", label: completenessLabels.companyName });
  }

  return missingFields;
};

const attentionFlagsForCharacter = (character: {
  dataSource: string;
  verificationStatus: string;
}) => {
  const flags: string[] = [];

  if (character.verificationStatus === "to_check") {
    flags.push("À vérifier");
  }

  if (character.verificationStatus === "disputed") {
    flags.push("Contestée");
  }

  if (character.verificationStatus === "imported" || character.dataSource === "notion") {
    flags.push("Importée");
  }

  if (character.verificationStatus === "community") {
    flags.push("Communautaire");
  }

  return flags;
};

const completenessPriority = (item: DataCompletenessItem) => {
  const reviewWeight = item.attentionFlags.some(
    (flag) => flag === "À vérifier" || flag === "Contestée"
  )
    ? 100
    : 0;
  const importedWeight = item.attentionFlags.some(
    (flag) => flag === "Importée" || flag === "Communautaire"
  )
    ? 20
    : 0;

  return reviewWeight + importedWeight + item.missingFields.length;
};

export class SequelizeDataCompletenessService implements DataCompletenessService {
  async getReport(): Promise<DataCompletenessReport> {
    const characters = await models.Character.findAll({
      attributes: [
        "id",
        "publicSlug",
        "firstName",
        "lastName",
        "nickname",
        "birthDate",
        "photoUrl",
        "phoneNumbers",
        "streamerId",
        "companyName",
        "companyRank",
        "companyBadgeNumber",
        "lifeStatus",
        "verificationStatus",
        "dataSource",
        "sourceNote",
        "updatedAt"
      ]
    });

    const items = characters
      .map((character) => {
        const missingFields = missingFieldsForCharacter({
          birthDate: character.birthDate,
          companyBadgeNumber: character.companyBadgeNumber,
          companyName: character.companyName,
          companyRank: character.companyRank,
          lifeStatus: character.lifeStatus,
          phoneNumbers: character.phoneNumbers ?? [],
          photoUrl: character.photoUrl
        });
        const attentionFlags = attentionFlagsForCharacter({
          dataSource: character.dataSource,
          verificationStatus: character.verificationStatus
        });

        return {
          id: character.id,
          publicSlug: character.publicSlug,
          fullName: fullName(character),
          verificationStatus: character.verificationStatus,
          dataSource: character.dataSource,
          missingFields,
          attentionFlags,
          updatedAt: character.updatedAt.toISOString()
        } satisfies DataCompletenessItem;
      })
      .filter((item) => item.missingFields.length > 0 || item.attentionFlags.length > 0)
      .sort((left, right) => {
        const score = completenessPriority(right) - completenessPriority(left);

        if (score !== 0) {
          return score;
        }

        return left.fullName.localeCompare(right.fullName, "fr");
      });

    return {
      summary: {
        total: characters.length,
        withMissingFields: items.filter((item) => item.missingFields.length > 0).length,
        importedOrCommunity: items.filter((item) =>
          item.attentionFlags.some((flag) => flag === "Importée" || flag === "Communautaire")
        ).length,
        needsReview: items.filter((item) =>
          item.attentionFlags.some((flag) => flag === "À vérifier" || flag === "Contestée")
        ).length
      },
      items
    };
  }
}
