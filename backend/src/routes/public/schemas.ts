import { z } from "zod";

import { lifeStatuses, verificationStatuses } from "../../db/enums.js";
import type {
  CharacterListFilters,
  CharacterMatchFilters,
  HistoryFilters
} from "../../services/public-data.js";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const charactersQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().min(1).max(160).optional(),
  lifeStatus: z.enum(lifeStatuses).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  streamer: z.string().trim().min(1).max(160).optional(),
  twitchLive: z.enum(["live"]).optional(),
  verificationStatus: z.enum(verificationStatuses).optional()
});

const characterMatchesQuerySchema = charactersQuerySchema.omit({
  limit: true,
  offset: true
});

const historyQuerySchema = paginationSchema.extend({
  characterId: z.uuid().optional()
});

const stripUndefinedProperties = <T extends Record<string, unknown>>(value: T) => {
  const output: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) {
      output[key] = fieldValue;
    }
  }

  return output;
};

export const idParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9-]+$/)
});

export const parseCharacterFilters = (query: unknown): CharacterListFilters =>
  stripUndefinedProperties(charactersQuerySchema.parse(query)) as CharacterListFilters;

export const parseCharacterMatchFilters = (query: unknown): CharacterMatchFilters =>
  stripUndefinedProperties(characterMatchesQuerySchema.parse(query)) as CharacterMatchFilters;

export const parseHistoryFilters = (query: unknown): HistoryFilters =>
  stripUndefinedProperties(historyQuerySchema.parse(query)) as HistoryFilters;
