import { Router } from "express";

import type { PublicDataService } from "../../services/public-data.js";
import { parseHistoryFilters } from "./schemas.js";

export const createPublicHistoryRouter = (publicDataService: PublicDataService) => {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      response.json(await publicDataService.listHistory(parseHistoryFilters(request.query)));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
