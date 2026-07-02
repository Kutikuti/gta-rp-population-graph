import type { CharacterSnapshot, LifeStatus, VerificationStatus } from "../api";
import { lifeStatusLabels, relationLabels, verificationLabels } from "../constants";

type FormatCharacterSnapshotValueOptions = {
  streamersById?: ReadonlyMap<string, string>;
  charactersById?: ReadonlyMap<string, string>;
};

const expandedSnapshotFields: ReadonlySet<keyof CharacterSnapshot> = new Set([
  "relationships",
  "phoneNumbers",
  "socialLinks"
]);

const socialPlatformLabels: Record<string, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok"
};

export const isExpandedCharacterSnapshotField = (field: keyof CharacterSnapshot): boolean =>
  expandedSnapshotFields.has(field);

export const formatCharacterSnapshotValue = (
  field: keyof CharacterSnapshot,
  value: unknown,
  options: FormatCharacterSnapshotValueOptions = {}
) => {
  if (value === null || value === undefined || value === "") {
    return "Non renseigné";
  }

  if (field === "lifeStatus") {
    return lifeStatusLabels[value as LifeStatus] ?? String(value);
  }

  if (field === "verificationStatus") {
    return verificationLabels[value as VerificationStatus] ?? String(value);
  }

  if (field === "streamerId" && typeof value === "string") {
    return options.streamersById?.get(value) ?? "Streamer inconnu";
  }

  if (field === "relationships" && Array.isArray(value)) {
    const items = value
      .map((relationship) => {
        if (
          !relationship ||
          typeof relationship !== "object" ||
          !("characterId" in relationship) ||
          !("type" in relationship)
        ) {
          return null;
        }

        const characterId = String(relationship.characterId);
        const type = String(relationship.type);

        return `• ${relationLabels[type] ?? type} : ${
          options.charactersById?.get(characterId) ?? characterId
        }`;
      })
      .filter(Boolean);

    return items.length ? items.join("\n") : "Aucune parenté";
  }

  if (field === "phoneNumbers" && Array.isArray(value)) {
    return value.length
      ? value.map((phoneNumber) => `• ${phoneNumber}`).join("\n")
      : "Non renseigné";
  }

  if (field === "socialLinks" && typeof value === "object") {
    const entries = Object.entries(value as Record<string, string>).filter(([, url]) =>
      Boolean(url)
    );

    return entries.length
      ? entries
          .map(([platform, url]) => `${socialPlatformLabels[platform] ?? platform}: ${url}`)
          .map((entry) => `• ${entry}`)
          .join("\n")
      : "Non renseigné";
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};
