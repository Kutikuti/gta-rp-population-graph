import type { NotionImportInput, NotionPageInput } from "./notion-import.js";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type NotionBlockValue = {
  id: string;
  type: string;
  properties?: Record<string, unknown>;
  content?: string[];
  collection_id?: string;
  space_id?: string;
  view_ids?: string[];
};

type NotionRecordMap = {
  block?: Record<string, { value?: NotionBlockValue }>;
  collection?: Record<string, { value?: NotionCollectionValue }>;
  collection_view?: Record<string, { value?: NotionCollectionViewValue }>;
};

type NotionCollectionValue = {
  id: string;
  space_id?: string;
  schema?: Record<string, { name?: string; type?: string }>;
  deleted_schema?: Record<string, { name?: string; type?: string }>;
};

type NotionCollectionViewValue = {
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

type ScrapeOptions = {
  fetch?: FetchLike;
};

const compact = <T>(values: Array<T | null | undefined>) =>
  values.filter((value): value is T => value !== null && value !== undefined);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const unwrapRecordValue = <T>(record: { value?: T | { value?: T } } | undefined): T | null => {
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

const plainText = (value: unknown): string | null => {
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

      if (Array.isArray(segment) && typeof segment[0] === "string") {
        return segment[0];
      }

      return "";
    })
    .join("")
    .trim();

  return text || null;
};

const pageTitle = (block: NotionBlockValue) => plainText(block.properties?.title) ?? "Sans titre";

const splitTitleName = (title: string) => {
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

const parsePropertiesFromText = (texts: string[]) => {
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

      properties[key] = value.includes(",")
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : value;
    }
  }

  return properties;
};

const loadPageChunk = async (
  pageId: string,
  fetchImpl: FetchLike,
  attempt = 0
): Promise<NotionRecordMap> => {
  const response = await fetchImpl("https://www.notion.so/api/v3/loadPageChunk", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      pageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false
    })
  });

  if (response.status === 429 && attempt < 5) {
    await delay((attempt + 1) * 1500);
    return loadPageChunk(pageId, fetchImpl, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Notion a refuse le chargement de la page ${pageId}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { recordMap?: NotionRecordMap };
  return payload.recordMap ?? (payload as NotionRecordMap);
};

const syncRecordValues = async (
  pageIds: string[],
  spaceId: string,
  fetchImpl: FetchLike,
  attempt = 0
): Promise<NotionRecordMap> => {
  const response = await fetchImpl("https://www.notion.so/api/v3/syncRecordValues", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      requests: pageIds.map((id) => ({
        pointer: {
          table: "block",
          id,
          spaceId
        },
        version: -1
      }))
    })
  });

  if (response.status === 429 && attempt < 5) {
    await delay((attempt + 1) * 1500);
    return syncRecordValues(pageIds, spaceId, fetchImpl, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Notion a refuse le chargement batch: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { recordMap?: NotionRecordMap };
  return payload.recordMap ?? (payload as NotionRecordMap);
};

const blockValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.block ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionBlockValue>(record)])
  );

const collectionValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionCollectionValue>(record)])
  );

const collectionViewValues = (recordMap: NotionRecordMap) =>
  Object.values(recordMap.collection_view ?? {}).flatMap((record) =>
    compact([unwrapRecordValue<NotionCollectionViewValue>(record)])
  );

const childPageIds = (recordMap: NotionRecordMap, rootPageId: string) =>
  blockValues(recordMap)
    .filter((block) => block.type === "page" && block.id !== rootPageId)
    .map((block) => block.id);

const textBlocks = (recordMap: NotionRecordMap) =>
  blockValues(recordMap).flatMap((block) => {
    if (block.type === "page") {
      return [];
    }

    return compact([plainText(block.properties?.title)]);
  });

const notionPageUrl = (sourceUrl: string, pageId: string) => {
  const base = new URL(sourceUrl);
  return `${base.origin}/${pageId.replaceAll("-", "")}`;
};

const schemaNameByPropertyId = (recordMap: NotionRecordMap) => {
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

const propertiesFromPageBlock = (
  pageBlock: NotionBlockValue,
  schemaNames: Map<string, string>
): Record<string, unknown> => {
  const properties: Record<string, unknown> = {};

  for (const [propertyId, value] of Object.entries(pageBlock.properties ?? {})) {
    const propertyName = schemaNames.get(propertyId) ?? propertyId;
    const text = plainText(value);

    if (text) {
      properties[propertyName] = text;
    }
  }

  const title = pageTitle(pageBlock);
  const fallbackName = splitTitleName(title);

  properties["Titre Notion"] = title;

  if (!properties.Prenom && fallbackName.firstName) {
    properties.Prenom = fallbackName.firstName;
  }

  if (!properties.Nom && fallbackName.lastName) {
    properties.Nom = fallbackName.lastName;
  }

  return properties;
};

const collectionPageSource = (recordMap: NotionRecordMap) => {
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

const chunk = <T>(values: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

const scrapeCollectionPages = async (
  rootRecordMap: NotionRecordMap,
  sourceUrl: string,
  fetchImpl: FetchLike
) => {
  const source = collectionPageSource(rootRecordMap);
  const ids = source.pageIds;
  const pages: NotionPageInput[] = [];
  const rootSchemaNames = schemaNameByPropertyId(rootRecordMap);

  if (!source.spaceId) {
    for (const pageId of ids) {
      await delay(100);

      const recordMap = await loadPageChunk(pageId, fetchImpl);
      const pageBlock = blockValues(recordMap).find((block) => block.id === pageId);

      if (!pageBlock) {
        continue;
      }

      pages.push({
        pageId,
        url: notionPageUrl(sourceUrl, pageId),
        properties: propertiesFromPageBlock(pageBlock, rootSchemaNames)
      });
    }

    return pages;
  }

  for (const pageIds of chunk(ids, 50)) {
    await delay(250);

    const recordMap = await syncRecordValues(pageIds, source.spaceId, fetchImpl);

    for (const pageBlock of blockValues(recordMap).filter((block) => block.type === "page")) {
      pages.push({
        pageId: pageBlock.id,
        url: notionPageUrl(sourceUrl, pageBlock.id),
        properties: propertiesFromPageBlock(pageBlock, rootSchemaNames)
      });
    }
  }

  return pages;
};

export const scrapePublicNotionPage = async (
  sourceUrl: string,
  options: ScrapeOptions = {}
): Promise<NotionImportInput> => {
  const fetchImpl = options.fetch ?? fetch;
  const rootPageId = extractNotionPageId(sourceUrl);
  const rootRecordMap = await loadPageChunk(rootPageId, fetchImpl);
  const pageIds = childPageIds(rootRecordMap, rootPageId);
  const pages: NotionPageInput[] = await scrapeCollectionPages(rootRecordMap, sourceUrl, fetchImpl);

  for (const pageId of pageIds.filter((id) => !pages.some((page) => page.pageId === id))) {
    const recordMap = await loadPageChunk(pageId, fetchImpl);
    const pageBlock = blockValues(recordMap).find((block) => block.id === pageId);

    if (!pageBlock) {
      continue;
    }

    const title = pageTitle(pageBlock);
    const properties = parsePropertiesFromText(textBlocks(recordMap));
    const fallbackName = splitTitleName(title);

    if (!properties.Prenom && fallbackName.firstName) {
      properties.Prenom = fallbackName.firstName;
    }

    if (!properties.Nom && fallbackName.lastName) {
      properties.Nom = fallbackName.lastName;
    }

    pages.push({
      pageId,
      url: notionPageUrl(sourceUrl, pageId),
      properties: {
        ...properties,
        "Titre Notion": title
      }
    });
  }

  if (pages.length === 0) {
    const rootBlock = blockValues(rootRecordMap).find((block) => block.id === rootPageId);
    const title = rootBlock ? pageTitle(rootBlock) : "Flashback Whitelist V6";
    const properties = parsePropertiesFromText(textBlocks(rootRecordMap));
    const fallbackName = splitTitleName(title);

    if (!properties.Prenom && fallbackName.firstName) {
      properties.Prenom = fallbackName.firstName;
    }

    if (!properties.Nom && fallbackName.lastName) {
      properties.Nom = fallbackName.lastName;
    }

    pages.push({
      pageId: rootPageId,
      url: sourceUrl,
      properties: {
        ...properties,
        "Titre Notion": title
      }
    });
  }

  return {
    sourceName: "Flashback Whitelist V6",
    sourceUrl,
    fullSource: true,
    pages
  };
};
