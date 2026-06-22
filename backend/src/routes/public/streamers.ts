import { Router } from "express";

import type { PublicDataService } from "../../services/public-data.js";

export const createPublicStreamersRouter = (publicDataService: PublicDataService) => {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await publicDataService.listStreamers());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
