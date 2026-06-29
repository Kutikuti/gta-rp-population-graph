export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium"
      }).format(new Date(value))
    : "Non renseigné";

export const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Non renseigné";

export const compactValue = (value: string | null | undefined) => value || "Non renseigné";

const socialPlatformOrder = ["twitch", "youtube", "instagram", "tiktok"] as const;
const socialPlatformRanks = new Map(
  socialPlatformOrder.map((platform, index) => [platform, index])
);

export const socialEntries = (links: Record<string, string> | null | undefined) =>
  Object.entries(links ?? {})
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .sort(([leftPlatform], [rightPlatform]) => {
      const leftRank = socialPlatformRanks.get(leftPlatform) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = socialPlatformRanks.get(rightPlatform) ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return leftPlatform.localeCompare(rightPlatform, "fr");
    });
