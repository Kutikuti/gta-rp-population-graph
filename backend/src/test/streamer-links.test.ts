import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  streamerFindByPk: vi.fn(),
  streamerFindOne: vi.fn(),
  streamerCreate: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Streamer: {
      findByPk: mockState.streamerFindByPk,
      findOne: mockState.streamerFindOne,
      create: mockState.streamerCreate
    }
  }
}));

import {
  mergeSocialLinks,
  normalizeSocialLinks,
  primaryPlatformFromSocialLinks,
  resolveOrCreateStreamer,
  resolvePrimaryPlatformForSync,
  resolveSocialLinksForSync
} from "../services/streamer-links.js";

describe("streamer-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("replaces social links during a direct manual sync", () => {
    expect(
      resolveSocialLinksForSync(
        {
          twitch: "https://twitch.tv/example",
          discord: "https://discord.gg/example"
        },
        {
          youtube: "https://youtube.com/@example"
        },
        "replace"
      )
    ).toEqual({
      youtube: "https://youtube.com/@example"
    });
  });

  it("clears the primary platform when a replace sync removes every social link", () => {
    expect(resolvePrimaryPlatformForSync("twitch", null, "replace")).toBeNull();
  });

  it("reuses and enriches an existing streamer when another imported character points to the same public name", async () => {
    const transaction = {} as never;
    const update = vi.fn().mockResolvedValue(undefined);
    mockState.streamerFindOne.mockResolvedValue({
      id: "streamer-1",
      publicName: "AdaLive",
      primaryPlatform: "twitch",
      socialLinks: {
        twitch: "https://twitch.tv/adalive"
      },
      update
    });

    const result = await resolveOrCreateStreamer({
      streamerPublicName: "AdaLive",
      socialLinks: {
        discord: "https://discord.gg/adalive"
      },
      verificationStatus: "imported",
      transaction
    });

    expect(result).toBe("streamer-1");
    expect(mockState.streamerCreate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      {
        socialLinks: {
          twitch: "https://twitch.tv/adalive",
          discord: "https://discord.gg/adalive"
        },
        primaryPlatform: "twitch"
      },
      { transaction }
    );
  });

  it("does not recreate or clear an existing streamer when a later import has no new social link to add", async () => {
    const transaction = {} as never;
    const existingStreamer = {
      id: "streamer-1",
      publicName: "AdaLive",
      primaryPlatform: "twitch",
      socialLinks: {
        twitch: "https://twitch.tv/adalive"
      },
      update: vi.fn().mockResolvedValue(undefined)
    };
    mockState.streamerFindOne.mockResolvedValue(existingStreamer);

    const result = await resolveOrCreateStreamer({
      streamerPublicName: "AdaLive",
      socialLinks: null,
      verificationStatus: "imported",
      transaction
    });

    expect(result).toBe("streamer-1");
    expect(mockState.streamerCreate).not.toHaveBeenCalled();
    expect(existingStreamer.update).not.toHaveBeenCalled();
  });
});
