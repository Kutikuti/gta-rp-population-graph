import { Router } from "express";

import type { PublicDataService } from "../../services/public-data.js";

export const createPublicGraphRouter = (publicDataService: PublicDataService) => {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await publicDataService.getGraph());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
