import { describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  characterFindAll: vi.fn(),
  relationshipBulkCreate: vi.fn(),
  relationshipDestroy: vi.fn(),
  resolveOrCreateStreamer: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Character: {
      findAll: mockState.characterFindAll
    },
    CharacterRelationship: {
      bulkCreate: mockState.relationshipBulkCreate,
      destroy: mockState.relationshipDestroy,
      findAll: vi.fn()
    }
  }
}));

vi.mock("../services/streamer-links.js", () => ({
  resolveOrCreateStreamer: mockState.resolveOrCreateStreamer
}));

vi.mock("../services/character-slug.js", () => ({
  generateUniqueCharacterSlug: vi.fn()
}));

import type { Character } from "../db/models/index.js";
import type { CharacterSnapshot } from "../services/change-request-schemas.js";
import { applySnapshot } from "../services/change-request-snapshots.js";

const snapshot: CharacterSnapshot = {
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
  relationships: [{ characterId: "missing-character", type: "sibling" }],
  previousCharacters: null,
  verificationStatus: "community",
  sourceNote: null
};

const character = {
  id: "character-1",
  firstName: "Camille",
  lastName: "Morel",
  publicSlug: "camille-morel",
  update: vi.fn()
} as unknown as Character;

describe("change request snapshots", () => {
  it("reports missing related characters with a dedicated API error", async () => {
    mockState.resolveOrCreateStreamer.mockResolvedValue(null);
    mockState.characterFindAll.mockResolvedValue([]);

    await expect(
      applySnapshot(character, snapshot, "moderation", {} as never)
    ).rejects.toMatchObject({
      status: 400,
      code: "RELATED_CHARACTER_NOT_FOUND",
      details: { missingCharacterIds: ["missing-character"] }
    });
    expect(mockState.relationshipDestroy).not.toHaveBeenCalled();
    expect(mockState.relationshipBulkCreate).not.toHaveBeenCalled();
  });
});
