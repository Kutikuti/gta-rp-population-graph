import { describe, expect, it } from "vitest";

import {
  escapeLikeLiteral,
  normalizeExactCaseInsensitive
} from "../services/notion-exact-match.js";

describe("Notion exact matching", () => {
  it.each([
    ["percent%value", "percent\\%value"],
    ["under_score", "under\\_score"],
    ["back\\slash", "back\\\\slash"],
    ["%_\\", "\\%\\_\\\\"]
  ])("escapes LIKE metacharacters in %s", (value, expected) => {
    expect(escapeLikeLiteral(value)).toBe(expected);
  });

  it("normalizes case without treating neighboring text or accents as identical", () => {
    expect(normalizeExactCaseInsensitive("Élodie")).toBe(normalizeExactCaseInsensitive("ÉLODIE"));
    expect(normalizeExactCaseInsensitive("Elodie")).not.toBe(
      normalizeExactCaseInsensitive("Élodie")
    );
    expect(normalizeExactCaseInsensitive("Ada")).not.toBe(normalizeExactCaseInsensitive("Adabel"));
  });
});
