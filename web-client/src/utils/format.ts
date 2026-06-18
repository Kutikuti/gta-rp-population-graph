export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium"
      }).format(new Date(value))
    : "Non renseigné";

export const compactValue = (value: string | null | undefined) => value || "Non renseigné";

export const socialEntries = (links: Record<string, string> | null | undefined) =>
  Object.entries(links ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
