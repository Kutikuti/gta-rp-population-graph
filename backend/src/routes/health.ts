import { Router } from "express";

export type DatabaseHealthCheck = () => Promise<void>;

const defaultTimeoutMs = 1_000;

export const createHealthRouter = (
  databaseHealthCheck: DatabaseHealthCheck,
  timeoutMs = defaultTimeoutMs
) => {
  const router = Router();

  router.get("/", async (_request, response) => {
    try {
      await Promise.race([
        databaseHealthCheck(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error("database health check timed out")), timeoutMs);
        })
      ]);
      response.json({
        status: "ok",
        service: "gta-rp-population-graph-api"
      });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  return router;
};
