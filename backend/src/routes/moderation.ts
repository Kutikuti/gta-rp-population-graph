import { Router } from "express";
import { z } from "zod";

import { requireRole } from "../middleware/auth.js";
import {
  type ChangeRequestService,
  directCharacterEditSchema,
  moderationListSchema,
  rejectChangeRequestSchema
} from "../services/change-requests.js";

const idParamSchema = z.object({
  id: z.uuid()
});

export const createModerationRouter = (changeRequestService: ChangeRequestService) => {
  const router = Router();

  router.get("/session", requireRole(["moderator", "administrator"]), (request, response) => {
    response.json({
      authenticated: true,
      area: "moderation",
      user: request.currentUser
    });
  });

  router.get(
    "/change-requests",
    requireRole(["moderator", "administrator"]),
    async (request, response, next) => {
      try {
        const filters = moderationListSchema.parse(request.query);
        response.json(await changeRequestService.listModerationChangeRequests(filters.status));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/change-requests/:id",
    requireRole(["moderator", "administrator"]),
    async (request, response, next) => {
      try {
        const { id } = idParamSchema.parse(request.params);
        const changeRequest = await changeRequestService.getModerationChangeRequest(id);

        if (!changeRequest) {
          response.status(404).json({
            error: {
              code: "CHANGE_REQUEST_NOT_FOUND",
              message: "Demande introuvable."
            }
          });
          return;
        }

        response.json(changeRequest);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/change-requests/:id/approve",
    requireRole(["moderator", "administrator"]),
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Moderation route reached without current user.");
        }

        const { id } = idParamSchema.parse(request.params);
        const result = await changeRequestService.approveChangeRequest({
          id,
          moderatorId: request.currentUser.id
        });

        if (!result) {
          response.status(404).json({
            error: {
              code: "CHANGE_REQUEST_NOT_FOUND",
              message: "Demande introuvable ou deja resolue."
            }
          });
          return;
        }

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/change-requests/:id/reject",
    requireRole(["moderator", "administrator"]),
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Moderation route reached without current user.");
        }

        const { id } = idParamSchema.parse(request.params);
        const payload = rejectChangeRequestSchema.parse(request.body);
        const changeRequest = await changeRequestService.rejectChangeRequest({
          id,
          moderatorId: request.currentUser.id,
          comment: payload.comment
        });

        if (!changeRequest) {
          response.status(404).json({
            error: {
              code: "CHANGE_REQUEST_NOT_FOUND",
              message: "Demande introuvable ou deja resolue."
            }
          });
          return;
        }

        response.json(changeRequest);
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/characters/:id",
    requireRole(["moderator", "administrator"]),
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Moderation route reached without current user.");
        }

        const { id } = idParamSchema.parse(request.params);
        const payload = directCharacterEditSchema.parse(request.body);
        const result = await changeRequestService.editCharacterDirectly({
          characterId: id,
          moderatorId: request.currentUser.id,
          snapshot: payload.snapshot
        });

        if (!result) {
          response.status(404).json({
            error: {
              code: "CHARACTER_NOT_FOUND",
              message: "Personnage introuvable."
            }
          });
          return;
        }

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
