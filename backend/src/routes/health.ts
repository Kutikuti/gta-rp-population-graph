import { Router } from "express";

export type DatabaseHealthCheck = () => Promise<void>;

const defaultTimeoutMs = 1_000;

export const createHealthRouter = (
  databaseHealthCheck: DatabaseHealthCheck,
  timeoutMs = defaultTimeoutMs
) => {
  const router = Router();
  let databaseHealthCheckInFlight = false;

  router.get("/", async (_request, response) => {
    if (databaseHealthCheckInFlight) {
      response.status(503).json({ status: "unavailable" });
      return;
    }

    databaseHealthCheckInFlight = true;
    const probe = Promise.resolve()
      .then(databaseHealthCheck)
      .finally(() => {
        databaseHealthCheckInFlight = false;
      });
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        probe,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("database health check timed out")),
            timeoutMs
          );
        })
      ]);
      response.json({
        status: "ok",
        service: "gta-rp-population-graph-api"
      });
    } catch {
      response.status(503).json({ status: "unavailable" });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  });

  return router;
};
