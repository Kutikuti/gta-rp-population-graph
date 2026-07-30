import type { NotionImportInput, NotionPageInput } from "./notion-import-schema.js";
import { pagePhotoReferences } from "./notion-scraper-photos.js";
import { blockValues, unwrapRecordValue } from "./notion-scraper-record-map.js";
import {
  linkUrl,
  normalizeLabel,
  pageMentionIds,
  pageTitle,
  plainText,
  splitTitleName
} from "./notion-scraper-text.js";
import type {
  NotionBlockValue,
  NotionCollectionValue,
  NotionCollectionViewValue,
  NotionRecordMap
} from "./notion-scraper-types.js";

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const maxRateLimitRetries = 12;

export const retryDelayMs = (response: Response, attempt: number) => {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const retrySeconds = Number.parseInt(retryAfter, 10);

    if (Number.isFinite(retrySeconds) && retrySeconds >= 0) {
      return retrySeconds * 1000;
    }
  }

  return Math.min(60_000, 2_500 * 2 ** attempt);
};

export const transientRetryDelayMs = (attempt: number) => Math.min(45_000, 1_500 * 2 ** attempt);

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

const collectionValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection ?? {})
    .map((record) => unwrapRecordValue<NotionCollectionValue>(record))
    .filter((value): value is NotionCollectionValue => Boolean(value));

const collectionViewValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection_view ?? {})
    .map((record) => unwrapRecordValue<NotionCollectionViewValue>(record))
    .filter((value): value is NotionCollectionViewValue => Boolean(value));

export const childPageIds = (recordMap: NotionRecordMap, rootPageId: string) =>
  blockValues(recordMap)
    .filter((block) => block.type === "page" && block.id !== rootPageId)
    .map((block) => block.id);

export const textBlocks = (recordMap: NotionRecordMap) =>
  blockValues(recordMap)
    .filter((block) => block.type !== "page")
    .map((block) => plainText(block.properties?.["title"], recordMap))
    .filter((text): text is string => Boolean(text));

export const notionPageUrl = (sourceUrl: string, pageId: string) => {
  const base = new URL(sourceUrl);
  return `${base.origin}/${pageId.replaceAll("-", "")}`;
};

const recordMapHasBlock = (recordMap: NotionRecordMap, blockId: string) =>
  Object.hasOwn(recordMap.block ?? {}, blockId);

const missingDirectChildBlockIds = (recordMap: NotionRecordMap, pageBlock: NotionBlockValue) =>
  (pageBlock.content ?? []).filter((childId) => !recordMapHasBlock(recordMap, childId));

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
    properties["Photo"] = photoReferences;
  }

  if (!properties["Prenom"] && fallbackName.firstName) {
    properties["Prenom"] = fallbackName.firstName;
  }

  if (!properties["Nom"] && fallbackName.lastName) {
    properties["Nom"] = fallbackName.lastName;
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

export { pagePhotoReferences } from "./notion-scraper-photos.js";
export { blockValues, mergeRecordMaps, unwrapRecordValue } from "./notion-scraper-record-map.js";
export {
  extractNotionPageId,
  pageTitle,
  parsePropertiesFromText,
  splitTitleName
} from "./notion-scraper-text.js";
export type {
  FetchLike,
  NotionBlockValue,
  NotionCollectionValue,
  NotionCollectionViewValue,
  NotionRecordMap,
  ScrapeOptions
} from "./notion-scraper-types.js";
export type { NotionImportInput, NotionPageInput };
