import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { env } from "../config/env.js";
import { models } from "../db/index.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import {
  type ChangeRequestService,
  changeRequestCreateSchema,
  characterCreationRequestSchema
} from "../services/change-requests.js";
import {
  createCharacterPhotoDraft,
  InvalidCharacterPhotoError
} from "../services/character-photos.js";

const idParamSchema = z.object({
  id: z.uuid()
});

const photoUploadRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.PHOTO_UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
});

const photoUploadBody = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: env.PHOTO_UPLOAD_MAX_BYTES
});

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
    "/characters/:id/photo-drafts",
    requireAuthenticatedUser,
    photoUploadRateLimit,
    photoUploadBody,
    async (request, response, next) => {
      try {
        if (!request.currentUser) {
          throw new Error("Authenticated route reached without current user.");
        }

        const { id } = idParamSchema.parse(request.params);
        const character = await models.Character.findByPk(id, {
          attributes: ["id"]
        });

        if (!character) {
          response.status(404).json({
            error: {
              code: "CHARACTER_NOT_FOUND",
              message: "Personnage introuvable."
            }
          });
          return;
        }

        if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
          response.status(400).json({
            error: {
              code: "EMPTY_PHOTO_UPLOAD",
              message: "Image absente."
            }
          });
          return;
        }

        const contentType = String(request.headers["content-type"] ?? "")
          .split(";")[0]
          ?.trim();

        const draft = await createCharacterPhotoDraft({
          userId: request.currentUser.id,
          buffer: request.body,
          contentType: contentType ?? ""
        });

        response.status(201).json(draft);
      } catch (error) {
        if (error instanceof InvalidCharacterPhotoError) {
          response.status(400).json({
            error: {
              code: "INVALID_CHARACTER_PHOTO",
              message: error.message
            }
          });
          return;
        }

        next(error);
      }
    }
  );

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
