import { renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { usePersistentFilters } from "./usePersistentFilters";

afterEach(() => window.localStorage.clear());

it("removes obsolete hidden filters and migrates a stored streamer search", () => {
  window.localStorage.setItem(
    "gta-rp-public-filters",
    JSON.stringify({ streamer: "NovaRP", verificationStatus: "to_check", twitchLive: "live" })
  );
  const { result } = renderHook(() => usePersistentFilters());
  expect(result.current[0]).toMatchObject({
    q: "NovaRP",
    streamer: "",
    verificationStatus: "",
    twitchLive: "live"
  });
});
