import { Router } from "express";
import { z } from "zod";

import { authProviders } from "../db/enums.js";
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

const identityParamsSchema = z.object({
  provider: z.enum(authProviders)
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

  router.delete(
    "/identities/:provider",
    requireAuthenticatedUser,
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Authenticated route reached without current user.");
        }

        const params = identityParamsSchema.parse(request.params);
        const result = await authService.unlinkIdentity(request.currentUser.id, params.provider);

        if (!result) {
          response.status(404).json({
            error: {
              code: "IDENTITY_NOT_FOUND",
              message: "Compte lié introuvable."
            }
          });
          return;
        }

        if (result === "last_identity") {
          response.status(409).json({
            error: {
              code: "LAST_IDENTITY",
              message: "Impossible de dissocier le dernier moyen de connexion."
            }
          });
          return;
        }

        response.json({ user: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
