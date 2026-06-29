import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import { TwitchLiveStatusService, twitchLiveTestUtils } from "../services/twitch-live.js";

describe("TwitchLiveStatusService", () => {
  const originalClientId = env.TWITCH_CLIENT_ID;
  const originalClientSecret = env.TWITCH_CLIENT_SECRET;

  beforeEach(() => {
    env.TWITCH_CLIENT_ID = "test-client-id";
    env.TWITCH_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    env.TWITCH_CLIENT_ID = originalClientId;
    env.TWITCH_CLIENT_SECRET = originalClientSecret;
    vi.unstubAllGlobals();
  });

  it("extracts a Twitch login from a public link", () => {
    expect(
      twitchLiveTestUtils.twitchLoginFromLinks({
        twitch: "https://twitch.tv/AdaLive"
      })
    ).toBe("adalive");
  });

  it("returns live when Twitch reports an active stream", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "app-token",
            expires_in: 3600
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "stream-1" }]
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const service = new TwitchLiveStatusService();
    const result = await service.getStatusForSocialLinks({
      twitch: "https://twitch.tv/AdaLive"
    });

    expect(result).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches the fetched status for the same Twitch login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "app-token",
            expires_in: 3600
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: []
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const service = new TwitchLiveStatusService();
    const first = await service.getStatusForSocialLinks({
      twitch: "https://twitch.tv/AdaLive"
    });
    const second = await service.getStatusForSocialLinks({
      twitch: "https://twitch.tv/AdaLive"
    });

    expect(first).toBe("offline");
    expect(second).toBe("offline");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns unknown when Twitch credentials are missing", async () => {
    env.TWITCH_CLIENT_ID = "";
    env.TWITCH_CLIENT_SECRET = "";

    const service = new TwitchLiveStatusService();

    await expect(
      service.getStatusForSocialLinks({
        twitch: "https://twitch.tv/AdaLive"
      })
    ).resolves.toBe("unknown");
  });
});
