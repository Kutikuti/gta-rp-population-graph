import { Router } from "express";

import type { PublicDataService } from "../../services/public-data.js";
import { idParamSchema, parseCharacterFilters } from "./schemas.js";

export const createPublicCharactersRouter = (publicDataService: PublicDataService) => {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const filters = parseCharacterFilters(request.query);
      response.json(await publicDataService.listCharacters(filters));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
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

  return router;
};
