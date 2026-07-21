import type { Request } from "express";

const loopbackAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const extractForwardedAddress = (value: string | string[] | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const [address] = value.split(",", 1);

  return address?.trim() || null;
};

const getRequestAddresses = (request: Request) =>
  [
    request.ip,
    request.socket.remoteAddress,
    extractForwardedAddress(request.headers["x-forwarded-for"])
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim());

const isLoopbackRequest = (request: Request) =>
  getRequestAddresses(request).some((address) => loopbackAddresses.has(address));

export const shouldSkipDevelopmentRateLimit = (request: Request) =>
  process.env["NODE_ENV"] !== "production" && isLoopbackRequest(request);
