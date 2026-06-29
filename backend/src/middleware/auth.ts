import type { Request, RequestHandler, Response } from "express";
import "express-session";

import { env } from "../config/env.js";
import type { AuthenticatedUser, AuthService } from "../services/auth.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    oauthIntent?: "login" | "link_google";
    oauthLinkUserId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser: AuthenticatedUser | null;
    }
  }
}

const clearSessionCookie = (response: Response) => {
  response.clearCookie(env.SESSION_COOKIE_NAME);
};

export const loadCurrentUser =
  (authService: AuthService): RequestHandler =>
  async (request, response, next) => {
    const { userId } = request.session;

    if (!userId) {
      request.currentUser = null;
      next();
      return;
    }

    try {
      const user = await authService.getSessionUser(userId);

      if (!user || user.isBanned) {
        request.currentUser = null;
        request.session.userId = undefined;
        clearSessionCookie(response);
        next();
        return;
      }

      request.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };

export const requireAuthenticatedUser: RequestHandler = (request, response, next) => {
  if (!request.currentUser) {
    response.status(401).json({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise."
      }
    });
    return;
  }

  next();
};

export const requireRole =
  (allowedRoles: AuthenticatedUser["role"]["name"][]): RequestHandler =>
  (request, response, next) => {
    if (!request.currentUser) {
      response.status(401).json({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentification requise."
        }
      });
      return;
    }

    if (!allowedRoles.includes(request.currentUser.role.name)) {
      response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Permissions insuffisantes."
        }
      });
      return;
    }

    next();
  };

export const destroySession = (request: Request) =>
  new Promise<void>((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const regenerateSession = (request: Request) =>
  new Promise<void>((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
