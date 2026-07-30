import type { NotionBlockValue, NotionRecordMap } from "./notion-scraper-types.js";

const compact = <T>(values: Array<T | null | undefined>) =>
  values.filter((value): value is T => value !== null && value !== undefined);

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
