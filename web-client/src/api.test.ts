import { describe, expect, it } from "vitest";

import { characterToSnapshot, type PublicCharacterDetail } from "./api";

const character: PublicCharacterDetail = {
  id: "00000000-0000-4000-8000-000000000301",
  publicSlug: "alix-mizuno",
  firstName: "Alix",
  lastName: "Mizuno",
  fullName: "Alix Mizuno",
  nickname: null,
  photoUrl: null,
  lifeStatus: "alive",
  phoneNumber: null,
  companyName: null,
  companyBadgeNumber: null,
  groupName: null,
  district: null,
  verificationStatus: "imported",
  dataSource: "notion",
  streamer: null,
  tags: [],
  updatedAt: "2026-06-26T00:00:00.000Z",
  birthDate: null,
  deathOrDepartureDate: null,
  companyRank: null,
  socialLinks: null,
  twitchLiveStatus: "unknown",
  isRpDeath: false,
  previousCharacters: null,
  sourceNote: null,
  relationships: {
    outgoing: [
      {
        id: "rel-1",
        sourceCharacterId: "00000000-0000-4000-8000-000000000301",
        targetCharacterId: "00000000-0000-4000-8000-000000000302",
        type: "sibling",
        graphVisible: true,
        direction: "symmetric",
        label: "Fratrie",
        description: null,
        source: "notion",
        verificationStatus: "imported",
        relatedCharacter: {
          id: "00000000-0000-4000-8000-000000000302",
          firstName: "Azula",
          lastName: "Mizuno",
          fullName: "Azula Mizuno"
        }
      }
    ],
    incoming: [
      {
        id: "rel-2",
        sourceCharacterId: "00000000-0000-4000-8000-000000000302",
        targetCharacterId: "00000000-0000-4000-8000-000000000301",
        type: "sibling",
        graphVisible: true,
        direction: "symmetric",
        label: "Fratrie",
        description: null,
        source: "notion",
        verificationStatus: "imported",
        relatedCharacter: {
          id: "00000000-0000-4000-8000-000000000302",
          firstName: "Azula",
          lastName: "Mizuno",
          fullName: "Azula Mizuno"
        }
      }
    ]
  },
  createdAt: "2026-06-26T00:00:00.000Z"
};

describe("characterToSnapshot", () => {
  it("deduplicates mirrored graph relationships for the edit form", () => {
    expect(characterToSnapshot(character).relationships).toEqual([
      {
        characterId: "00000000-0000-4000-8000-000000000302",
        type: "sibling"
      }
    ]);
  });
});
