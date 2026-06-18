import { Router } from "express";

import { type PublicDataService, SequelizePublicDataService } from "../../services/public-data.js";
import { createPublicCharactersRouter } from "./characters.js";
import { createPublicGraphRouter } from "./graph.js";
import { createPublicHistoryRouter } from "./history.js";
import { createPublicTagsRouter } from "./tags.js";

export const createPublicRouter = (
  publicDataService: PublicDataService = new SequelizePublicDataService()
) => {
  const router = Router();

  router.use("/characters", createPublicCharactersRouter(publicDataService));
  router.use("/tags", createPublicTagsRouter(publicDataService));
  router.use("/graph", createPublicGraphRouter(publicDataService));
  router.use("/history", createPublicHistoryRouter(publicDataService));

  return router;
};
