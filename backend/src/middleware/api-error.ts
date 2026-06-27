import type { JsonObject } from "../db/models/index.js";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: JsonObject | null;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: JsonObject | null;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? null;
  }
}

export const notFoundError = (code: string, message: string, details?: JsonObject | null) =>
  new ApiError({ status: 404, code, message, details });

export const badRequestError = (code: string, message: string, details?: JsonObject | null) =>
  new ApiError({ status: 400, code, message, details });

export const conflictError = (code: string, message: string, details?: JsonObject | null) =>
  new ApiError({ status: 409, code, message, details });
