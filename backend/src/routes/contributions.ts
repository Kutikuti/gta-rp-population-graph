import { Router } from "express";

import { requireAuthenticatedUser } from "../middleware/auth.js";

export const contributionsRouter = Router();

contributionsRouter.get("/session", requireAuthenticatedUser, (request, response) => {
  response.json({
    authenticated: true,
    area: "contributions",
    user: request.currentUser
  });
});
