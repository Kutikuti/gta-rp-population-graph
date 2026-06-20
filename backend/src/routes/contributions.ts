import { Router } from "express";

import { requireAuthenticatedUser } from "../middleware/auth.js";
import {
  type ChangeRequestService,
  changeRequestCreateSchema,
  characterCreationRequestSchema
} from "../services/change-requests.js";

export const createContributionsRouter = (changeRequestService: ChangeRequestService) => {
  const router = Router();

  router.get("/session", requireAuthenticatedUser, (request, response) => {
    response.json({
      authenticated: true,
      area: "contributions",
      user: request.currentUser
    });
  });

  router.get("/change-requests", requireAuthenticatedUser, async (request, response, next) => {
    try {
      if (!request.currentUser) {
        throw new Error("Authenticated route reached without current user.");
      }

      response.json(await changeRequestService.listUserChangeRequests(request.currentUser.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/change-requests", requireAuthenticatedUser, async (request, response, next) => {
    try {
      if (!request.currentUser) {
        throw new Error("Authenticated route reached without current user.");
      }

      const payload = changeRequestCreateSchema.parse(request.body);
      const changeRequest = await changeRequestService.createChangeRequest({
        userId: request.currentUser.id,
        characterId: payload.characterId,
        proposedSnapshot: payload.proposedSnapshot
      });

      if (!changeRequest) {
        response.status(404).json({
          error: {
            code: "CHARACTER_NOT_FOUND",
            message: "Personnage introuvable."
          }
        });
        return;
      }

      response.status(201).json(changeRequest);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/change-requests/character-creations",
    requireAuthenticatedUser,
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Authenticated route reached without current user.");
        }

        const payload = characterCreationRequestSchema.parse(request.body);
        const changeRequest = await changeRequestService.createCharacterCreationRequest({
          userId: request.currentUser.id,
          proposedSnapshot: payload.proposedSnapshot,
          searchContext: payload.searchContext
        });

        if (changeRequest === "duplicate") {
          response.status(409).json({
            error: {
              code: "POSSIBLE_DUPLICATE_CHARACTER",
              message: "Un personnage porte deja ce nom et ce prenom."
            }
          });
          return;
        }

        response.status(201).json(changeRequest);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
