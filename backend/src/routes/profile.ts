import { Router } from "express";
import { z } from "zod";

import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AuthService } from "../services/auth.js";

const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u)
});

export const createProfileRouter = (authService: AuthService) => {
  const router = Router();

  router.get("/", requireAuthenticatedUser, (request, response) => {
    response.json({
      user: request.currentUser
    });
  });

  router.patch("/display-name", requireAuthenticatedUser, async (request, response, next) => {
    try {
      if (!request.currentUser) {
        throw new Error("Authenticated route reached without current user.");
      }

      const payload = displayNameSchema.parse(request.body);
      const user = await authService.updateDisplayName(request.currentUser.id, payload.displayName);

      if (!user) {
        response.status(404).json({
          error: {
            code: "USER_NOT_FOUND",
            message: "Utilisateur introuvable."
          }
        });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
