import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  characterFindAll: vi.fn(),
  relationshipFindAll: vi.fn(),
  relationshipBulkCreate: vi.fn(),
  relationshipDestroy: vi.fn(),
  resolveOrCreateStreamer: vi.fn(),
  deleteStoredCharacterPhoto: vi.fn(),
  promoteCharacterPhotoIfPending: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Character: {
      findAll: mockState.characterFindAll
    },
    CharacterRelationship: {
      bulkCreate: mockState.relationshipBulkCreate,
      destroy: mockState.relationshipDestroy,
      findAll: mockState.relationshipFindAll
    }
  }
}));

vi.mock("../services/streamer-links.js", () => ({
  resolveOrCreateStreamer: mockState.resolveOrCreateStreamer
}));

vi.mock("../services/character-slug.js", () => ({
  generateUniqueCharacterSlug: vi.fn()
}));

vi.mock("../services/character-photos.js", () => ({
  deleteStoredCharacterPhoto: mockState.deleteStoredCharacterPhoto,
  promoteCharacterPhotoIfPending: mockState.promoteCharacterPhotoIfPending
}));

import type { Character } from "../db/models/index.js";
import type { CharacterSnapshot } from "../services/change-request-schemas.js";
import { applySnapshot, characterToSnapshot } from "../services/change-request-snapshots.js";

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.relationshipDestroy.mockResolvedValue(0);
    mockState.relationshipBulkCreate.mockResolvedValue([]);
    mockState.resolveOrCreateStreamer.mockResolvedValue(null);
    mockState.promoteCharacterPhotoIfPending.mockImplementation(
      async (photoUrl: string | null) => photoUrl
    );
  });

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

  it("reports a dedicated error when an existing relationship type cannot be edited in snapshots", async () => {
    mockState.relationshipFindAll.mockResolvedValue([
      {
        id: "relationship-1",
        sourceCharacterId: "character-1",
        targetCharacterId: "character-2",
        type: "legacy_uneditable",
        direction: "undirected"
      }
    ]);

    await expect(characterToSnapshot({ ...character, ...snapshot } as never)).rejects.toMatchObject(
      {
        status: 500,
        code: "CHANGE_REQUEST_RELATIONSHIP_TYPE_NOT_EDITABLE",
        details: {
          relationshipId: "relationship-1",
          type: "legacy_uneditable",
          sourceCharacterId: "character-1",
          targetCharacterId: "character-2",
          currentCharacterId: "character-1"
        }
      }
    );
  });

  it("cleans the previous stored photo when a validated snapshot removes it", async () => {
    const characterWithPhoto = {
      ...character,
      photoUrl: "/uploads/characters/previous.webp",
      update: vi.fn()
    } as unknown as Character;
    const snapshotWithoutPhoto: CharacterSnapshot = {
      ...snapshot,
      relationships: [],
      photoUrl: null
    };

    await applySnapshot(characterWithPhoto, snapshotWithoutPhoto, "moderation", {} as never);

    expect(characterWithPhoto.update).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: null }),
      expect.any(Object)
    );
    expect(mockState.deleteStoredCharacterPhoto).toHaveBeenCalledWith(
      "/uploads/characters/previous.webp"
    );
  });
});
