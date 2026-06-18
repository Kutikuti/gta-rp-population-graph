import { Router } from "express";

import { requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.get("/session", requireRole(["administrator"]), (request, response) => {
  response.json({
    authenticated: true,
    area: "administration",
    user: request.currentUser
  });
});
