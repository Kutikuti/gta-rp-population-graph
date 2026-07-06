import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicCharacterDetail } from "../api";
import { CharacterSheet } from "./CharacterSheet";

const character: PublicCharacterDetail = {
  id: "char-1",
  publicSlug: "camille-morel",
  firstName: "Camille",
  lastName: "Morel",
  fullName: "Camille Morel",
  nickname: null,
  photoUrl: null,
  lifeStatus: "alive",
  phoneNumbers: [],
  companyName: null,
  companyBadgeNumber: null,
  groupName: null,
  district: null,
  verificationStatus: "community",
  dataSource: "manual",
  streamer: {
    id: "streamer-1",
    publicName: "NovaRP",
    primaryPlatform: "twitch",
    socialLinks: {
      twitch: "https://twitch.tv/novarp"
    },
    twitchLiveStatus: "offline",
    verificationStatus: "community"
  },
  tags: [],
  updatedAt: "2026-07-06T00:00:00.000Z",
  birthDate: null,
  deathOrDepartureDate: null,
  companyRank: null,
  twitchLiveStatus: "offline",
  isRpDeath: false,
  previousCharacters: null,
  sourceNote: null,
  relationships: {
    outgoing: [],
    incoming: []
  },
  createdAt: "2026-07-06T00:00:00.000Z"
};

describe("CharacterSheet", () => {
  it("explains that public links come from the linked streamer", () => {
    render(
      <CharacterSheet
        canEditDirectly={false}
        character={character}
        history={[]}
        onClose={() => {}}
        onContribute={() => {}}
        onShare={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Médias du streamer" })).toBeInTheDocument();
    expect(
      screen.getByText(/les liens publics affichés ici sont ceux du streamer rattaché/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/streamer rattaché : novarp/i)).toBeInTheDocument();
  });

  it("shows a dedicated empty state when no streamer is linked", () => {
    render(
      <CharacterSheet
        canEditDirectly={false}
        character={{ ...character, streamer: null }}
        history={[]}
        onClose={() => {}}
        onContribute={() => {}}
        onShare={() => {}}
      />
    );

    expect(screen.getByText("Aucun streamer rattaché.")).toBeInTheDocument();
  });
});
