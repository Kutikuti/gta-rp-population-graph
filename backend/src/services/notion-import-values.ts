import { z } from "zod";

const stringList = z.union([z.string(), z.array(z.string())]).optional();

export const uniqueStrings = (values: string[]) => [...new Set(values)];

export const stringValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const booleanValue = (value: unknown): boolean | null => {
  const normalized = stringValue(value)?.toLowerCase();

  if (normalized === "yes" || normalized === "oui" || normalized === "true") {
    return true;
  }

  if (normalized === "no" || normalized === "non" || normalized === "false") {
    return false;
  }

  return null;
};

export const listValue = (value: unknown): string[] => {
  const parsed = stringList.safeParse(value);

  if (!parsed.success || parsed.data === undefined) {
    return [];
  }

  const values = Array.isArray(parsed.data) ? parsed.data : parsed.data.split(",");
  return uniqueStrings(values.map((item) => item.trim()).filter(Boolean));
};

export const dateValue = (value: unknown): string | null => {
  const raw = stringValue(value);

  if (!raw || raw === "‣") {
    return null;
  }

  const isoDate = raw.match(/\b\d{4}-\d{2}-\d{2}\b/u)?.[0];

  if (isoDate) {
    return isoDate;
  }

  const frenchDate = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/u);

  if (!frenchDate) {
    return null;
  }

  const [, day, month, year] = frenchDate;

  if (!day || !month || !year) {
    return null;
  }

  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${paddedMonth}-${paddedDay}`;
};
