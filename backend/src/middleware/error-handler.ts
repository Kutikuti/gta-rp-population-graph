import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { InvalidCharacterPhotoError } from "../services/character-photos.js";
import { ApiError } from "./api-error.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${request.method} ${request.path} introuvable.`
    }
  });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if ((error as { type?: string }).type === "entity.too.large") {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Charge utile trop volumineuse."
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Parametres de requete invalides.",
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      }
    });
    return;
  }

  if (error instanceof InvalidCharacterPhotoError) {
    response.status(400).json({
      error: {
        code: "INVALID_CHARACTER_PHOTO",
        message: error.message
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  console.error(error);

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Une erreur interne est survenue."
    }
  });
};
