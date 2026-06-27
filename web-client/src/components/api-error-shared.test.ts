import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../api";
import { apiErrorMessage } from "./api-error-shared";

describe("apiErrorMessage", () => {
  it("returns the fallback message for non API errors", () => {
    expect(apiErrorMessage(new Error("boom"), "Erreur par défaut", {})).toBe("Erreur par défaut");
  });

  it("returns the mapped message when the API error code is known", () => {
    const error = new ApiRequestError("Message backend", 409, "KNOWN_CODE");

    expect(
      apiErrorMessage(error, "Erreur par défaut", {
        KNOWN_CODE: "Message frontend"
      })
    ).toBe("Message frontend");
  });

  it("falls back to the backend message when the API error code is unknown", () => {
    const error = new ApiRequestError("Message backend", 409, "UNKNOWN_CODE");

    expect(apiErrorMessage(error, "Erreur par défaut", {})).toBe("Message backend");
  });
});
