import { Router } from "express";

export const supervisionRouter = Router();

supervisionRouter.get("/authorize", (request, response) => {
  if (!request.currentUser) {
    response.redirect(302, "/?login=required&redirect=/supervision/");
    return;
  }

  if (request.currentUser.role.name !== "administrator") {
    response.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Permissions insuffisantes."
      }
    });
    return;
  }

  response.setHeader("X-WEBAUTH-USER", request.currentUser.displayName);
  response.status(204).send();
});
