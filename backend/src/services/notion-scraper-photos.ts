import type { NotionBlockValue, NotionRecordMap } from "./notion-scraper-types.js";

const compact = <T>(values: Array<T | null | undefined>) =>
  values.filter((value): value is T => value !== null && value !== undefined);

const unwrapBlockRecordValue = (
  record: { value?: NotionBlockValue | { value?: NotionBlockValue } } | undefined
): NotionBlockValue | null => {
  const value = record?.value;

  if (!value) {
    return null;
  }

  if ("id" in value && "type" in value) {
    return value;
  }

  return value.value ?? null;
};

const blockValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.block ?? {}).flatMap((record) =>
    compact([unwrapBlockRecordValue(record)])
  );

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
