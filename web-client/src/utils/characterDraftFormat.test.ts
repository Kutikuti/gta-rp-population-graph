import { describe, expect, it } from "vitest";

import {
  formatCharacterSnapshotValue,
  isExpandedCharacterSnapshotField
} from "./characterDraftFormat";

describe("characterDraftFormat", () => {
  it("formats relationships as a readable multi-line list", () => {
    expect(
      formatCharacterSnapshotValue(
        "relationships",
        [
          { characterId: "char-1", type: "couple" },
          { characterId: "char-2", type: "ex_partner_reference" }
        ],
        {
          charactersById: new Map([
            ["char-1", "Grace Hopper"],
            ["char-2", "Charles Babbage"]
          ])
        }
      )
    ).toBe("• Couple : Grace Hopper\n• Ex : Charles Babbage");
  });

  it("marks relationship, phone and social link fields as expanded values", () => {
    expect(isExpandedCharacterSnapshotField("relationships")).toBe(true);
    expect(isExpandedCharacterSnapshotField("phoneNumbers")).toBe(true);
    expect(isExpandedCharacterSnapshotField("socialLinks")).toBe(true);
    expect(isExpandedCharacterSnapshotField("firstName")).toBe(false);
  });
});
