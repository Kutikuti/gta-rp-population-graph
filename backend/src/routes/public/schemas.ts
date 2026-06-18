import { z } from "zod";

import { lifeStatuses, verificationStatuses } from "../../db/enums.js";
import type {
  CharacterListFilters,
  HistoryFilters,
  Pagination
} from "../../services/public-data.js";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const charactersQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  lifeStatus: z.enum(lifeStatuses).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  streamer: z.string().trim().min(1).max(160).optional(),
  verificationStatus: z.enum(verificationStatuses).optional()
});

export const historyQuerySchema = paginationSchema.extend({
  characterId: z.uuid().optional()
});

export const idParamSchema = z.object({
  id: z.uuid()
});

export const parseCharacterFilters = (query: unknown): CharacterListFilters =>
  charactersQuerySchema.parse(query);

export const parsePagination = (query: unknown): Pagination => paginationSchema.parse(query);

export const parseHistoryFilters = (query: unknown): HistoryFilters =>
  historyQuerySchema.parse(query);
