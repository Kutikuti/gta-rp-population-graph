import { badRequestError } from "../middleware/api-error.js";
import { unwrapRecordValue } from "./notion-scraper-record-map.js";
import type { NotionBlockValue, NotionRecordMap } from "./notion-scraper-types.js";

export const extractNotionPageId = (url: string) => {
  const parsedUrl = new URL(url);
  const lastPathSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const match = lastPathSegment.replaceAll("-", "").match(/([0-9a-f]{32})$/i);

  if (!match) {
    throw badRequestError(
      "NOTION_PAGE_ID_MISSING",
      "URL Notion invalide: aucun identifiant de page trouve.",
      {
        url
      }
    );
  }

  const id = match[0].toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(
    16,
    20
  )}-${id.slice(20)}`;
};

const pageMentionIdFromAnnotations = (annotations: unknown[]) => {
  for (const annotation of annotations) {
    if (!Array.isArray(annotation) || annotation[0] !== "p" || typeof annotation[1] !== "string") {
      continue;
    }

    return annotation[1];
  }

  return null;
};

const dateTextFromAnnotations = (annotations: unknown[]) => {
  for (const annotation of annotations) {
    if (
      !Array.isArray(annotation) ||
      annotation[0] !== "d" ||
      !annotation[1] ||
      typeof annotation[1] !== "object" ||
      !("start_date" in annotation[1])
    ) {
      continue;
    }

    const startDate = (annotation[1] as { start_date?: unknown }).start_date;

    if (typeof startDate === "string" && startDate.trim()) {
      return startDate.trim();
    }
  }

  return null;
};

const linkUrlFromAnnotations = (annotations: unknown[]) => {
  for (const annotation of annotations) {
    if (!Array.isArray(annotation) || annotation[0] !== "a" || typeof annotation[1] !== "string") {
      continue;
    }

    const url = annotation[1].trim();

    if (url) {
      return url;
    }
  }

  return null;
};

const pageTitleFromRecordMap = (recordMap: NotionRecordMap, pageId: string) => {
  const block = unwrapRecordValue<NotionBlockValue>(recordMap.block?.[pageId]);
  return block ? plainText(block.properties?.["title"], recordMap) : null;
};

export const plainText = (value: unknown, recordMap?: NotionRecordMap): string | null => {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .map((segment) => {
      if (typeof segment === "string") {
        return segment;
      }

      if (!Array.isArray(segment) || typeof segment[0] !== "string") {
        return "";
      }

      const rawText = segment[0];
      const annotations = Array.isArray(segment[1]) ? segment[1] : [];
      const dateText = dateTextFromAnnotations(annotations);

      if (dateText) {
        return dateText;
      }

      if (rawText === "‣" && recordMap) {
        const pageId = pageMentionIdFromAnnotations(annotations);
        const title = pageId ? pageTitleFromRecordMap(recordMap, pageId) : null;

        if (title) {
          return title;
        }
      }

      return rawText;
    })
    .join("")
    .trim();

  return text || null;
};

export const linkUrl = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const segment of value) {
    if (!Array.isArray(segment) || !Array.isArray(segment[1])) {
      continue;
    }

    const url = linkUrlFromAnnotations(segment[1]);

    if (url) {
      return url;
    }
  }

  return null;
};

export const pageMentionIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: string[] = [];

  for (const segment of value) {
    if (!Array.isArray(segment) || !Array.isArray(segment[1])) {
      continue;
    }

    const pageId = pageMentionIdFromAnnotations(segment[1]);

    if (pageId) {
      ids.push(pageId);
    }
  }

  return ids;
};

export const pageTitle = (block: NotionBlockValue, recordMap?: NotionRecordMap) =>
  plainText(block.properties?.["title"], recordMap) ?? "Sans titre";

export const splitTitleName = (title: string) => {
  const clean = title.trim().replace(/\s+/g, " ");
  const parts = clean.split(" ");

  if (parts.length < 2) {
    return { firstName: clean, lastName: null };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? null
  };
};

export const normalizeLabel = (label: string) =>
  label
    .trim()
    .replace(/^[*-]\s*/, "")
    .replace(/\s+/g, " ");

const appendPropertyValue = (
  properties: Record<string, unknown>,
  key: string,
  value: string | string[]
) => {
  const existing = properties[key];
  const nextValues = Array.isArray(value) ? value : [value];

  if (existing === undefined) {
    properties[key] = Array.isArray(value) ? value : value;
    return;
  }

  const merged = [
    ...(Array.isArray(existing) ? existing : [existing]).filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    ),
    ...nextValues
  ];
  const unique = [...new Set(merged.map((item) => item.trim()).filter(Boolean))];

  properties[key] = unique.length <= 1 ? (unique[0] ?? null) : unique;
};

export const parsePropertiesFromText = (texts: string[]) => {
  const properties: Record<string, unknown> = {};

  for (const text of texts) {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      const match = line.match(/^([^:：]{1,80})\s*[:：]\s*(.+)$/);

      if (!match) {
        continue;
      }

      const rawKey = match[1];
      const rawValue = match[2];

      if (!rawKey || !rawValue) {
        continue;
      }

      const key = normalizeLabel(rawKey);
      const value = rawValue.trim();

      if (!key || !value) {
        continue;
      }

      appendPropertyValue(
        properties,
        key,
        value.includes(",")
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : value
      );
    }
  }

  return properties;
};
