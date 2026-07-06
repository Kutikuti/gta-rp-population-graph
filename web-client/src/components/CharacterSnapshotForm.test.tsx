import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CharacterSnapshot, PublicStreamer } from "../api";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";

const baseSnapshot: CharacterSnapshot = {
  firstName: "Camille",
  lastName: "Morel",
  nickname: null,
  birthDate: null,
  lifeStatus: "alive",
  deathOrDepartureDate: null,
  photoUrl: null,
  companyName: null,
  companyRank: null,
  companyBadgeNumber: null,
  phoneNumbers: [],
  streamerId: null,
  streamerName: null,
  socialLinks: null,
  groupName: null,
  district: null,
  isRpDeath: false,
  relationships: [],
  previousCharacters: null,
  verificationStatus: "to_check",
  sourceNote: null
};

const streamers: PublicStreamer[] = [
  {
    id: "streamer-1",
    publicName: "NovaRP",
    primaryPlatform: "twitch",
    socialLinks: {
      twitch: "https://twitch.tv/novarp",
      discord: "https://discord.gg/novarp"
    },
    twitchLiveStatus: "offline",
    verificationStatus: "community"
  }
];

function FormHarness({ initialSnapshot = baseSnapshot }: { initialSnapshot?: CharacterSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  return (
    <CharacterSnapshotForm
      snapshot={snapshot}
      characterOptions={[]}
      currentCharacterId={null}
      streamers={streamers}
      submitLabel="Modifier"
      isSubmitting={false}
      canUploadPhoto={false}
      isPhotoUploading={false}
      onCancel={() => {}}
      onChange={setSnapshot}
      onPhotoUpload={vi.fn(async () => {})}
      onSubmit={() => {}}
    />
  );
}

describe("CharacterSnapshotForm", () => {
  it("loads the selected streamer's links into the media fields", async () => {
    const user = userEvent.setup();

    render(<FormHarness />);

    const streamerSelect = screen.getByLabelText("Streamer existant");
    const twitchInput = screen.getByLabelText("Twitch");
    const discordInput = screen.getByLabelText("Discord");

    expect(twitchInput).toBeDisabled();
    expect(discordInput).toBeDisabled();

    await user.selectOptions(streamerSelect, "streamer-1");

    expect(twitchInput).toHaveValue("https://twitch.tv/novarp");
    expect(discordInput).toHaveValue("https://discord.gg/novarp");
    expect(twitchInput).not.toBeDisabled();
    expect(discordInput).not.toBeDisabled();
  });

  it("clears media links when the streamer is removed", async () => {
    const user = userEvent.setup();

    render(
      <FormHarness
        initialSnapshot={{
          ...baseSnapshot,
          streamerId: "streamer-1",
          socialLinks: streamers[0].socialLinks
        }}
      />
    );

    const streamerSelect = screen.getByLabelText("Streamer existant");
    const twitchInput = screen.getByLabelText("Twitch");
    const discordInput = screen.getByLabelText("Discord");

    expect(twitchInput).toHaveValue("https://twitch.tv/novarp");
    expect(discordInput).toHaveValue("https://discord.gg/novarp");

    await user.selectOptions(streamerSelect, "");

    expect(twitchInput).toHaveValue("");
    expect(discordInput).toHaveValue("");
    expect(twitchInput).toBeDisabled();
    expect(discordInput).toBeDisabled();
  });
});
