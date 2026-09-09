import type { RequestHandler } from "express";

import { env } from "../config/env.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const clientOrigin = new URL(env.WEB_CLIENT_URL).origin;

export const requireTrustedWriteOrigin: RequestHandler = (request, response, next) => {
  if (safeMethods.has(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  const fetchSite = request.get("sec-fetch-site");
  // Origin is compared exactly: sibling subdomains are not trusted just because
  // the browser considers them same-site. Non-browser API clients may omit it.
  if (
    (origin !== undefined && origin !== clientOrigin) ||
    (origin === undefined && (fetchSite === "cross-site" || fetchSite === "same-site"))
  ) {
    response.status(403).json({
      error: {
        code: "UNTRUSTED_REQUEST_ORIGIN",
        message: "Origine de la requête non autorisée."
      }
    });
    return;
  }

  next();
};
