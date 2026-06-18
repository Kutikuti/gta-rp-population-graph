import { Router } from "express";

import { requireRole } from "../middleware/auth.js";

export const moderationRouter = Router();

moderationRouter.get(
  "/session",
  requireRole(["moderator", "administrator"]),
  (request, response) => {
    response.json({
      authenticated: true,
      area: "moderation",
      user: request.currentUser
    });
  }
);
