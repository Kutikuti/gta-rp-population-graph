import { describe, expect, it } from "vitest";

import {
  mergeSocialLinks,
  normalizeSocialLinks,
  primaryPlatformFromSocialLinks
} from "../services/streamer-links.js";

describe("streamer-links", () => {
  it("normalizes empty social links to null", () => {
    expect(
      normalizeSocialLinks({
        twitch: "   ",
        discord: ""
      })
    ).toBeNull();
  });

  it("derives the primary platform from the prioritized order", () => {
    expect(
      primaryPlatformFromSocialLinks({
        instagram: "https://instagram.com/example",
        discord: "https://discord.gg/example",
        youtube: "https://youtube.com/@example"
      })
    ).toBe("youtube");
  });

  it("merges existing and incoming social links without dropping known entries", () => {
    expect(
      mergeSocialLinks(
        {
          twitch: "https://twitch.tv/example"
        },
        {
          discord: "https://discord.gg/example"
        }
      )
    ).toEqual({
      twitch: "https://twitch.tv/example",
      discord: "https://discord.gg/example"
    });
  });
});
