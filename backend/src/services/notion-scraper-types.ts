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
