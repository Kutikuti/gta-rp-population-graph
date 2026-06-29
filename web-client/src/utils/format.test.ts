import { describe, expect, it } from "vitest";

import { socialEntries } from "./format";

describe("socialEntries", () => {
  it("sorts known social links with Twitch first", () => {
    expect(
      socialEntries({
        instagram: "https://instagram.com/example",
        tiktok: "https://tiktok.com/@example",
        youtube: "https://youtube.com/@example",
        twitch: "https://twitch.tv/example"
      })
    ).toEqual([
      ["twitch", "https://twitch.tv/example"],
      ["youtube", "https://youtube.com/@example"],
      ["instagram", "https://instagram.com/example"],
      ["tiktok", "https://tiktok.com/@example"]
    ]);
  });

  it("keeps unknown platforms after the prioritized ones", () => {
    expect(
      socialEntries({
        kick: "https://kick.com/example",
        youtube: "https://youtube.com/@example",
        twitch: "https://twitch.tv/example"
      })
    ).toEqual([
      ["twitch", "https://twitch.tv/example"],
      ["youtube", "https://youtube.com/@example"],
      ["kick", "https://kick.com/example"]
    ]);
  });
});
