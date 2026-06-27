import {
  blockValues,
  childPageIds,
  chunk,
  collectionPageSource,
  delay,
  extractNotionPageId,
  type FetchLike,
  maxRateLimitRetries,
  mergeRecordMaps,
  missingPageDependencyIds,
  type NotionBlockValue,
  type NotionImportInput,
  type NotionPageInput,
  type NotionRecordMap,
  notionPageUrl,
  pagePhotoReferences,
  pageTitle,
  parsePropertiesFromText,
  propertiesFromPageBlock,
  retryDelayMs,
  type ScrapeOptions,
  schemaNameByPropertyId,
  splitTitleName,
  textBlocks,
  transientRetryDelayMs,
  unwrapRecordValue
} from "./notion-scraper-shared.js";

const isRetryableFetchError = (error: unknown) =>
  error instanceof TypeError || (error instanceof Error && error.name === "AbortError");

const requestNotionRecordMap = async (input: {
  url: string;
  body: Record<string, unknown>;
  fetchImpl: FetchLike;
  attempt: number;
  failureMessage: string;
}): Promise<NotionRecordMap> => {
  let response: Response;

  try {
    response = await input.fetchImpl(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input.body)
    });
  } catch (error) {
    if (isRetryableFetchError(error) && input.attempt < maxRateLimitRetries) {
      await delay(transientRetryDelayMs(input.attempt));
      return requestNotionRecordMap({
        ...input,
        attempt: input.attempt + 1
      });
    }

    throw error;
  }

  if ((response.status === 429 || response.status >= 500) && input.attempt < maxRateLimitRetries) {
    await delay(
      response.status === 429
        ? retryDelayMs(response, input.attempt)
        : transientRetryDelayMs(input.attempt)
    );
    return requestNotionRecordMap({
      ...input,
      attempt: input.attempt + 1
    });
  }

  if (!response.ok) {
    throw new Error(`${input.failureMessage}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { recordMap?: NotionRecordMap };
  return payload.recordMap ?? (payload as NotionRecordMap);
};

const loadPageChunk = async (
  pageId: string,
  fetchImpl: FetchLike,
  attempt = 0
): Promise<NotionRecordMap> => {
  return requestNotionRecordMap({
    url: "https://www.notion.so/api/v3/loadPageChunk",
    body: {
      pageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false
    },
    fetchImpl,
    attempt,
    failureMessage: `Notion a refuse le chargement de la page ${pageId}`
  });
};

const syncRecordValues = async (
  pageIds: string[],
  spaceId: string,
  fetchImpl: FetchLike,
  attempt = 0
): Promise<NotionRecordMap> => {
  return requestNotionRecordMap({
    url: "https://www.notion.so/api/v3/syncRecordValues",
    body: {
      requests: pageIds.map((id) => ({
        pointer: {
          table: "block",
          id,
          spaceId
        },
        version: -1
      }))
    },
    fetchImpl,
    attempt,
    failureMessage: "Notion a refuse le chargement batch"
  });
};

const hydrateMissingPageDependencies = async (
  recordMap: NotionRecordMap,
  spaceId: string,
  fetchImpl: FetchLike,
  maxPasses = 4
) => {
  let hydrated = recordMap;
  let previousMissingSignature: string | null = null;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const missingIds = missingPageDependencyIds(hydrated);

    if (missingIds.length === 0) {
      break;
    }

    const missingSignature = missingIds.join(",");

    if (missingSignature === previousMissingSignature) {
      break;
    }

    previousMissingSignature = missingSignature;

    for (const childIds of chunk(missingIds, 50)) {
      if (childIds.length === 0) {
        continue;
      }

      await delay(400);
      const childRecordMap = await syncRecordValues(childIds, spaceId, fetchImpl);
      hydrated = mergeRecordMaps(hydrated, childRecordMap);
    }
  }

  return hydrated;
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
        properties: propertiesFromPageBlock(recordMap, pageBlock, rootSchemaNames)
      });
    }

    return pages;
  }

  for (const pageIds of chunk(ids, 50)) {
    await delay(250);

    let recordMap = await syncRecordValues(pageIds, source.spaceId, fetchImpl);
    recordMap = await hydrateMissingPageDependencies(recordMap, source.spaceId, fetchImpl);

    for (const pageBlock of pageIds
      .map((pageId) => unwrapRecordValue<NotionBlockValue>(recordMap.block?.[pageId]))
      .filter((block): block is NotionBlockValue => block !== null && block.type === "page")) {
      pages.push({
        pageId: pageBlock.id,
        url: notionPageUrl(sourceUrl, pageBlock.id),
        properties: propertiesFromPageBlock(recordMap, pageBlock, rootSchemaNames)
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

    const title = pageTitle(pageBlock, recordMap);
    const properties = parsePropertiesFromText(textBlocks(recordMap));
    const fallbackName = splitTitleName(title);
    const photoReferences = pagePhotoReferences(recordMap, pageBlock);

    if (!properties.Prenom && fallbackName.firstName) {
      properties.Prenom = fallbackName.firstName;
    }

    if (!properties.Nom && fallbackName.lastName) {
      properties.Nom = fallbackName.lastName;
    }

    if (photoReferences.length > 0) {
      properties.Photo = photoReferences;
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
    const title = rootBlock ? pageTitle(rootBlock, rootRecordMap) : "Flashback Whitelist V6";
    const properties = parsePropertiesFromText(textBlocks(rootRecordMap));
    const fallbackName = splitTitleName(title);
    const photoReferences = rootBlock ? pagePhotoReferences(rootRecordMap, rootBlock) : [];

    if (!properties.Prenom && fallbackName.firstName) {
      properties.Prenom = fallbackName.firstName;
    }

    if (!properties.Nom && fallbackName.lastName) {
      properties.Nom = fallbackName.lastName;
    }

    if (photoReferences.length > 0) {
      properties.Photo = photoReferences;
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

export { extractNotionPageId };
