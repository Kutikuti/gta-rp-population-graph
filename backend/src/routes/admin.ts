import { Router } from "express";
import { z } from "zod";

import { roleNames, tagTypes } from "../db/enums.js";
import { conflictError, notFoundError } from "../middleware/api-error.js";
import { requireRole } from "../middleware/auth.js";
import { type AdminService, SequelizeAdminService } from "../services/admin.js";

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

export const createAdminRouter = (adminService: AdminService = new SequelizeAdminService()) => {
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
        throw notFoundError("NOTION_IMPORT_ENTRY_NOT_FOUND", "Entrée d'import Notion introuvable.");
      }

      if (result.status === "invalid") {
        throw conflictError(result.code, result.message, result.details ?? null);
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
          throw notFoundError(
            "NOTION_IMPORT_ENTRY_NOT_FOUND",
            "Entrée d'import Notion introuvable."
          );
        }

        if (result.status === "invalid") {
          throw conflictError(result.code, result.message, result.details ?? null);
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
