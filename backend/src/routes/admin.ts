import { Router } from "express";
import { z } from "zod";

import { authProviders, roleNames, tagTypes } from "../db/enums.js";
import { badRequestError, conflictError, notFoundError } from "../middleware/api-error.js";
import { requireRole } from "../middleware/auth.js";
import { type AdminService, SequelizeAdminService } from "../services/admin.js";
import type {
  AdminNotionImportApplyResult,
  AdminNotionImportPhotoResult
} from "../services/admin-notion-imports.js";
import {
  type DataCompletenessService,
  SequelizeDataCompletenessService
} from "../services/data-completeness.js";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const tagInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(tagTypes).nullable(),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
  description: nullableText(800)
});

const roleInputSchema = z.object({
  role: z.enum(roleNames)
});

const banInputSchema = z.object({
  reason: z.string().trim().min(3).max(800)
});

const identityParamsSchema = z.object({
  id: z.string().trim().min(1),
  provider: z.enum(authProviders)
});

const notionImportEntryNotFoundError = () =>
  notFoundError("NOTION_IMPORT_ENTRY_NOT_FOUND", "Entrée d'import Notion introuvable.");

const notionImportInvalidError = (
  result: Extract<
    AdminNotionImportApplyResult | AdminNotionImportPhotoResult,
    { status: "invalid" }
  >
) => {
  switch (result.code) {
    case "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT":
    case "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY":
    case "NOTION_IMPORT_ENTRY_NO_PHOTO":
    case "NOTION_IMPORT_ENTRY_INVALID_PHOTO":
      return badRequestError(result.code, result.message, result.details ?? null);
    case "NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND":
      return notFoundError(result.code, result.message, result.details ?? null);
    default:
      return conflictError(result.code, result.message, result.details ?? null);
  }
};

export const createAdminRouter = (
  adminService: AdminService = new SequelizeAdminService(),
  dataCompletenessService: DataCompletenessService = new SequelizeDataCompletenessService()
) => {
  const router = Router();

  router.use(requireRole(["administrator"]));

  router.get("/session", (request, response) => {
    response.json({
      authenticated: true,
      area: "administration",
      user: request.currentUser
    });
  });

  router.get("/dashboard", async (_request, response, next) => {
    try {
      response.json(await adminService.getDashboard());
    } catch (error) {
      next(error);
    }
  });

  router.get("/users/:id/personal-data", async (request, response, next) => {
    try {
      const exportPayload = await adminService.exportUserPersonalData(request.params.id);

      if (!exportPayload) {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      response.json(exportPayload);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/users/:id/sessions", async (request, response, next) => {
    try {
      const result = await adminService.revokeUserSessions(
        request.currentUser?.id ?? "",
        request.params.id
      );

      if (result.status === "not_found") {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      if (result.status === "self") {
        throw conflictError(
          "SELF_SESSION_REVOCATION",
          "Impossible de révoquer tes propres sessions depuis l'administration."
        );
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/users/:id/identities/:provider", async (request, response, next) => {
    try {
      const params = identityParamsSchema.parse(request.params);
      const result = await adminService.unlinkUserIdentity(
        request.currentUser?.id ?? "",
        params.id,
        params.provider
      );

      if (result.status === "not_found") {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      if (result.status === "identity_not_found") {
        throw notFoundError("IDENTITY_NOT_FOUND", "Compte lié introuvable.");
      }

      if (result.status === "last_identity") {
        throw conflictError(
          "LAST_IDENTITY",
          "Impossible de dissocier le dernier moyen de connexion."
        );
      }

      if (result.status === "self") {
        throw conflictError(
          "SELF_IDENTITY_UNLINK",
          "Impossible de dissocier tes propres comptes liés depuis l'administration."
        );
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/users/:id/personal-data", async (request, response, next) => {
    try {
      const result = await adminService.anonymizeUserAccount(
        request.currentUser?.id ?? "",
        request.params.id
      );

      if (result.status === "not_found") {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      if (result.status === "last_admin") {
        throw conflictError("LAST_ADMIN", "Impossible d'anonymiser le dernier administrateur.");
      }

      if (result.status === "self") {
        throw conflictError(
          "SELF_ACCOUNT_ANONYMIZATION",
          "Impossible d'anonymiser ton propre compte depuis l'administration."
        );
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/completeness", async (_request, response, next) => {
    try {
      response.json(await dataCompletenessService.getReport());
    } catch (error) {
      next(error);
    }
  });

  router.get("/notion-imports", async (_request, response, next) => {
    try {
      response.json(await adminService.listNotionImports());
    } catch (error) {
      next(error);
    }
  });

  router.get("/notion-imports/:id", async (request, response, next) => {
    try {
      const detail = await adminService.getNotionImportDetail(request.params.id);

      if (!detail) {
        throw notFoundError("NOTION_IMPORT_NOT_FOUND", "Lot d'import Notion introuvable.");
      }

      response.json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.post("/notion-imports/:id/entries/:pageId/apply", async (request, response, next) => {
    try {
      const result = await adminService.applyNotionImportEntry({
        actorUserId: request.currentUser?.id ?? "",
        batchId: request.params.id,
        pageId: request.params.pageId
      });

      if (result.status === "not_found") {
        throw notionImportEntryNotFoundError();
      }

      if (result.status === "invalid") {
        throw notionImportInvalidError(result);
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/notion-imports/:id/entries/:pageId/import-photo",
    async (request, response, next) => {
      try {
        const result = await adminService.importNotionImportEntryPhoto({
          actorUserId: request.currentUser?.id ?? "",
          batchId: request.params.id,
          pageId: request.params.pageId
        });

        if (result.status === "not_found") {
          throw notionImportEntryNotFoundError();
        }

        if (result.status === "invalid") {
          throw notionImportInvalidError(result);
        }

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/tags", async (request, response, next) => {
    try {
      const input = tagInputSchema.parse(request.body);
      response.status(201).json(await adminService.createTag(request.currentUser?.id ?? "", input));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/tags/:id", async (request, response, next) => {
    try {
      const input = tagInputSchema.parse(request.body);
      const tag = await adminService.updateTag(
        request.currentUser?.id ?? "",
        request.params.id,
        input
      );

      if (!tag) {
        throw notFoundError("TAG_NOT_FOUND", "Tag introuvable.");
      }

      response.json(tag);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/tags/:id", async (request, response, next) => {
    try {
      const result = await adminService.deleteTag(request.currentUser?.id ?? "", request.params.id);

      if (result === "not_found") {
        throw notFoundError("TAG_NOT_FOUND", "Tag introuvable.");
      }

      if (result === "in_use") {
        throw conflictError(
          "TAG_IN_USE",
          "Ce tag est encore rattache a un ou plusieurs personnages."
        );
      }

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.patch("/users/:id/role", async (request, response, next) => {
    try {
      const input = roleInputSchema.parse(request.body);
      const user = await adminService.updateUserRole(
        request.currentUser?.id ?? "",
        request.params.id,
        input.role
      );

      if (user === "last_admin") {
        throw conflictError("LAST_ADMIN", "Impossible de retirer le dernier administrateur actif.");
      }

      if (!user) {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      response.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.post("/users/:id/ban", async (request, response, next) => {
    try {
      const input = banInputSchema.parse(request.body);
      const user = await adminService.banUser(
        request.currentUser?.id ?? "",
        request.params.id,
        input
      );

      if (!user) {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      response.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/users/:id/ban", async (request, response, next) => {
    try {
      const user = await adminService.revokeUserBan(
        request.currentUser?.id ?? "",
        request.params.id
      );

      if (!user) {
        throw notFoundError("USER_NOT_FOUND", "Utilisateur introuvable.");
      }

      response.json(user);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
