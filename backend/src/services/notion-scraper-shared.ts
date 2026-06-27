import type { NotionImportInput, NotionPageInput } from "./notion-import-schema.js";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type NotionBlockValue = {
  id: string;
  type: string;
  properties?: Record<string, unknown>;
  content?: string[];
  collection_id?: string;
  format?: {
    display_source?: unknown;
    page_cover?: unknown;
    page_icon?: unknown;
    social_media_image_preview_url?: unknown;
  };
  space_id?: string;
  view_ids?: string[];
};

export type NotionRecordMap = {
  block?: Record<string, { value?: NotionBlockValue }>;
  collection?: Record<string, { value?: NotionCollectionValue }>;
  collection_view?: Record<string, { value?: NotionCollectionViewValue }>;
};

export type NotionCollectionValue = {
  id: string;
  space_id?: string;
  schema?: Record<string, { name?: string; type?: string }>;
  deleted_schema?: Record<string, { name?: string; type?: string }>;
};

export type NotionCollectionViewValue = {
  id: string;
  type: string;
  name?: string;
  space_id?: string;
  page_sort?: string[];
  format?: {
    collection_pointer?: {
      id?: string;
      spaceId?: string;
    };
  };
};

export type ScrapeOptions = {
  fetch?: FetchLike;
};

export const compact = <T>(values: Array<T | null | undefined>) =>
  values.filter((value): value is T => value !== null && value !== undefined);

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const maxRateLimitRetries = 8;

export const retryDelayMs = (response: Response, attempt: number) => {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const retrySeconds = Number.parseInt(retryAfter, 10);

    if (Number.isFinite(retrySeconds) && retrySeconds >= 0) {
      return retrySeconds * 1000;
    }
  }

  return Math.min(30_000, 1_500 * 2 ** attempt);
};

export const transientRetryDelayMs = (attempt: number) => Math.min(30_000, 1_000 * 2 ** attempt);

export const unwrapRecordValue = <T>(
  record: { value?: T | { value?: T } } | undefined
): T | null => {
  const value = record?.value;

  if (!value) {
    return null;
  }

  if (typeof value === "object" && "value" in value) {
    return value.value ?? null;
  }

  return value as T;
};

export const extractNotionPageId = (url: string) => {
  const parsedUrl = new URL(url);
  const lastPathSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const match = lastPathSegment.replaceAll("-", "").match(/([0-9a-f]{32})$/i);

  if (!match) {
    throw new Error("URL Notion invalide: aucun identifiant de page trouve.");
  }

  const id = match[0].toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(
    16,
    20
  )}-${id.slice(20)}`;
};

export const pageMentionIdFromAnnotations = (annotations: unknown[]) => {
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
  return block ? plainText(block.properties?.title, recordMap) : null;
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

const linkUrl = (value: unknown): string | null => {
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

export const pageTitle = (block: NotionBlockValue, recordMap?: NotionRecordMap) =>
  plainText(block.properties?.title, recordMap) ?? "Sans titre";

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

const normalizeLabel = (label: string) =>
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

const socialPropertyNames = new Set([
  "twitch",
  "kick",
  "youtube",
  "you tube",
  "instagram",
  "tiktok",
  "tik tok"
]);

const isSocialPropertyName = (propertyName: string) =>
  socialPropertyNames.has(normalizeLabel(propertyName).toLowerCase());

export const blockValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.block ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionBlockValue>(record)])
  );

export const mergeRecordMaps = (
  base: NotionRecordMap,
  extra: NotionRecordMap
): NotionRecordMap => ({
  block: {
    ...(base.block ?? {}),
    ...(extra.block ?? {})
  },
  collection: {
    ...(base.collection ?? {}),
    ...(extra.collection ?? {})
  },
  collection_view: {
    ...(base.collection_view ?? {}),
    ...(extra.collection_view ?? {})
  }
});

const collectionValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionCollectionValue>(record)])
  );

const collectionViewValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection_view ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionCollectionViewValue>(record)])
  );

export const childPageIds = (recordMap: NotionRecordMap, rootPageId: string) =>
  blockValues(recordMap)
    .filter((block) => block.type === "page" && block.id !== rootPageId)
    .map((block) => block.id);

export const textBlocks = (recordMap: NotionRecordMap) =>
  blockValues(recordMap).flatMap((block) => {
    if (block.type === "page") {
      return [];
    }

    return compact([plainText(block.properties?.title, recordMap)]);
  });

export const notionPageUrl = (sourceUrl: string, pageId: string) => {
  const base = new URL(sourceUrl);
  return `${base.origin}/${pageId.replaceAll("-", "")}`;
};

const notionImageReference = (value: unknown, blockId: string, spaceId?: string) => {
  if (typeof value !== "string") {
    return null;
  }

  const reference = value.trim();

  if (!reference) {
    return null;
  }

  if (/^https?:\/\//iu.test(reference)) {
    return reference;
  }

  if (reference.startsWith("attachment:")) {
    const url = new URL(`https://www.notion.so/image/${encodeURIComponent(reference)}`);
    url.searchParams.set("table", "block");
    url.searchParams.set("id", blockId);
    url.searchParams.set("cache", "v2");
    url.searchParams.set("width", "2000");

    if (spaceId) {
      url.searchParams.set("spaceId", spaceId);
    }

    return url.toString();
  }

  if (reference.startsWith("/")) {
    return `https://www.notion.so${reference}`;
  }

  return null;
};

const descendantBlocks = (recordMap: NotionRecordMap, rootIds: string[]) => {
  const blocksById = new Map(blockValues(recordMap).map((block) => [block.id, block] as const));
  const visited = new Set<string>();
  const stack = [...rootIds];
  const descendants: NotionBlockValue[] = [];

  while (stack.length > 0) {
    const blockId = stack.shift();

    if (!blockId || visited.has(blockId)) {
      continue;
    }

    visited.add(blockId);

    const block = blocksById.get(blockId);

    if (!block) {
      continue;
    }

    descendants.push(block);

    for (const childId of block.content ?? []) {
      stack.push(childId);
    }
  }

  return descendants;
};

const uniquePhotoReferences = (references: Array<string | null>) => [
  ...new Set(compact(references))
];

export const pagePhotoReferences = (recordMap: NotionRecordMap, pageBlock: NotionBlockValue) => {
  const inlineMedia = descendantBlocks(recordMap, pageBlock.content ?? []).flatMap((block) => {
    if (!["image", "file", "pdf", "video", "audio"].includes(block.type)) {
      return [];
    }

    return compact([notionImageReference(block.format?.display_source, block.id, block.space_id)]);
  });

  const pageMedia = compact([
    notionImageReference(pageBlock.format?.page_icon, pageBlock.id, pageBlock.space_id),
    notionImageReference(pageBlock.format?.page_cover, pageBlock.id, pageBlock.space_id),
    notionImageReference(
      pageBlock.format?.social_media_image_preview_url,
      pageBlock.id,
      pageBlock.space_id
    )
  ]);

  if (inlineMedia.length > 0) {
    return uniquePhotoReferences(inlineMedia);
  }

  return uniquePhotoReferences(pageMedia);
};

const recordMapHasBlock = (recordMap: NotionRecordMap, blockId: string) =>
  Object.hasOwn(recordMap.block ?? {}, blockId);

const missingDirectChildBlockIds = (recordMap: NotionRecordMap, pageBlock: NotionBlockValue) =>
  (pageBlock.content ?? []).filter((childId) => !recordMapHasBlock(recordMap, childId));

const pageMentionIds = (value: unknown): string[] => {
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

const missingMentionedPageIds = (recordMap: NotionRecordMap, pageBlock: NotionBlockValue) => {
  const ids = Object.values(pageBlock.properties ?? {}).flatMap((value) => pageMentionIds(value));
  return [...new Set(ids)].filter((pageId) => !recordMapHasBlock(recordMap, pageId));
};

export const missingPageDependencyIds = (recordMap: NotionRecordMap) => [
  ...new Set(
    blockValues(recordMap)
      .filter((block) => block.type === "page")
      .flatMap((pageBlock) => [
        ...missingDirectChildBlockIds(recordMap, pageBlock),
        ...missingMentionedPageIds(recordMap, pageBlock)
      ])
  )
];

export const schemaNameByPropertyId = (recordMap: NotionRecordMap) => {
  const collection = collectionValues(recordMap).find(
    (candidate) => candidate.schema || candidate.deleted_schema
  );
  const schema = {
    ...(collection?.deleted_schema ?? {}),
    ...(collection?.schema ?? {})
  };

  return new Map(
    Object.entries(schema).map(([propertyId, property]) => [
      propertyId,
      propertyId === "title" ? "Titre Notion" : (property.name ?? propertyId)
    ])
  );
};

export const propertiesFromPageBlock = (
  recordMap: NotionRecordMap,
  pageBlock: NotionBlockValue,
  schemaNames: Map<string, string>
): Record<string, unknown> => {
  const properties: Record<string, unknown> = {};

  for (const [propertyId, value] of Object.entries(pageBlock.properties ?? {})) {
    const propertyName = schemaNames.get(propertyId) ?? propertyId;
    const text = isSocialPropertyName(propertyName)
      ? (linkUrl(value) ?? plainText(value, recordMap))
      : plainText(value, recordMap);

    if (text) {
      properties[propertyName] = text;
    }
  }

  const title = pageTitle(pageBlock, recordMap);
  const fallbackName = splitTitleName(title);
  const photoReferences = pagePhotoReferences(recordMap, pageBlock);

  properties["Titre Notion"] = title;

  if (photoReferences.length > 0) {
    properties.Photo = photoReferences;
  }

  if (!properties.Prenom && fallbackName.firstName) {
    properties.Prenom = fallbackName.firstName;
  }

  if (!properties.Nom && fallbackName.lastName) {
    properties.Nom = fallbackName.lastName;
  }

  return properties;
};

export const collectionPageSource = (recordMap: NotionRecordMap) => {
  const views = collectionViewValues(recordMap)
    .filter((view) => view.page_sort && view.page_sort.length > 0)
    .sort((left, right) => {
      if (left.name === "Tous") {
        return -1;
      }

      if (right.name === "Tous") {
        return 1;
      }

      return (right.page_sort?.length ?? 0) - (left.page_sort?.length ?? 0);
    });
  const selectedView = views.at(0);

  return {
    pageIds: selectedView?.page_sort ?? [],
    collectionId: selectedView?.format?.collection_pointer?.id ?? null,
    spaceId: selectedView?.format?.collection_pointer?.spaceId ?? selectedView?.space_id ?? null
  };
};

export const chunk = <T>(values: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

export type { NotionImportInput, NotionPageInput };
