import { Router } from "express";
import { z } from "zod";

import { lifeStatuses, verificationStatuses } from "../db/enums.js";
import {
  SequelizePublicDataService,
  type CharacterListFilters,
  type Pagination,
  type PublicDataService
} from "../services/public-data.js";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const charactersQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  lifeStatus: z.enum(lifeStatuses).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  streamer: z.string().trim().min(1).max(160).optional(),
  verificationStatus: z.enum(verificationStatuses).optional()
});

const idParamSchema = z.object({
  id: z.uuid()
});

const parseCharacterFilters = (query: unknown): CharacterListFilters =>
  charactersQuerySchema.parse(query);

const parsePagination = (query: unknown): Pagination => paginationSchema.parse(query);

export const createPublicRouter = (
  publicDataService: PublicDataService = new SequelizePublicDataService()
) => {
  const router = Router();

  router.get("/characters", async (request, response, next) => {
    try {
      const filters = parseCharacterFilters(request.query);
      response.json(await publicDataService.listCharacters(filters));
    } catch (error) {
      next(error);
    }
  });

  router.get("/characters/:id", async (request, response, next) => {
    try {
      const { id } = idParamSchema.parse(request.params);
      const character = await publicDataService.getCharacter(id);

      if (!character) {
        response.status(404).json({
          error: {
            code: "CHARACTER_NOT_FOUND",
            message: "Personnage introuvable."
          }
        });
        return;
      }

      response.json(character);
    } catch (error) {
      next(error);
    }
  });

  router.get("/tags", async (_request, response, next) => {
    try {
      response.json(await publicDataService.listTags());
    } catch (error) {
      next(error);
    }
  });

  router.get("/graph", async (_request, response, next) => {
    try {
      response.json(await publicDataService.getGraph());
    } catch (error) {
      next(error);
    }
  });

  router.get("/history", async (request, response, next) => {
    try {
      const pagination = parsePagination(request.query);
      response.json(await publicDataService.listHistory(pagination));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
