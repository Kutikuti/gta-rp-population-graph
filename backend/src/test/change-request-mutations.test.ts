import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  applySnapshot: vi.fn(),
  calculateCharacterCreationDiff: vi.fn(),
  calculateCharacterDiff: vi.fn(),
  changeHistoryCreate: vi.fn(),
  characterCreate: vi.fn(),
  characterFindByPk: vi.fn(),
  characterToSnapshot: vi.fn(),
  generateUniqueCharacterSlug: vi.fn(),
  prepareSnapshotForWrite: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    ChangeHistory: { create: mockState.changeHistoryCreate },
    Character: {
      create: mockState.characterCreate,
      findByPk: mockState.characterFindByPk
    }
  }
}));

vi.mock("../services/change-request-snapshots.js", () => ({
  applySnapshot: mockState.applySnapshot,
  calculateCharacterCreationDiff: mockState.calculateCharacterCreationDiff,
  calculateCharacterDiff: mockState.calculateCharacterDiff,
  characterToSnapshot: mockState.characterToSnapshot,
  prepareSnapshotForWrite: mockState.prepareSnapshotForWrite
}));

vi.mock("../services/character-slug.js", () => ({
  generateUniqueCharacterSlug: mockState.generateUniqueCharacterSlug
}));

import {
  applyDirectCharacterCreation,
  applyDirectCharacterEdit,
  approvePendingChangeRequest
} from "../services/change-request-mutations.js";
import type { CharacterSnapshot } from "../services/change-request-schemas.js";

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
  relationships: [],
  previousCharacters: null,
  verificationStatus: "community",
  sourceNote: null
};

const preparedSnapshot = { ...snapshot, sourceNote: "Préparée" };
const transaction = { LOCK: { UPDATE: "UPDATE" } };
const character = { id: "character-1" };

describe("change request mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.prepareSnapshotForWrite.mockResolvedValue(preparedSnapshot);
    mockState.generateUniqueCharacterSlug.mockResolvedValue("camille-morel");
    mockState.characterCreate.mockResolvedValue(character);
    mockState.calculateCharacterCreationDiff.mockReturnValue({ firstName: { new: "Camille" } });
    mockState.calculateCharacterDiff.mockReturnValue({
      sourceNote: { old: null, new: "Préparée" }
    });
    mockState.characterToSnapshot.mockResolvedValue(snapshot);
  });

  it("creates a character and its history in the supplied transaction", async () => {
    const result = await applyDirectCharacterCreation({
      moderatorId: "moderator-1",
      snapshot,
      transaction: transaction as never
    });

    expect(mockState.generateUniqueCharacterSlug).toHaveBeenCalledWith(
      "Camille",
      "Morel",
      transaction
    );
    expect(mockState.characterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: "contribution",
        firstName: "Camille",
        publicSlug: "camille-morel",
        streamerId: null
      }),
      { transaction }
    );
    expect(mockState.applySnapshot).toHaveBeenCalledWith(
      character,
      preparedSnapshot,
      "contribution",
      transaction
    );
    expect(mockState.changeHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: null,
        characterId: "character-1",
        moderatorId: "moderator-1"
      }),
      { transaction }
    );
    expect(result).toEqual({
      characterId: "character-1",
      changes: { firstName: { new: "Camille" } }
    });
  });

  it("returns null when an update request no longer has a target character", async () => {
    const request = {
      id: "request-1",
      requestType: "update",
      characterId: "missing",
      update: vi.fn()
    };
    mockState.characterFindByPk.mockResolvedValue(null);

    await expect(
      approvePendingChangeRequest({
        moderatorId: "moderator-1",
        proposedSnapshot: snapshot,
        request: request as never,
        transaction: transaction as never
      })
    ).resolves.toBeNull();
    expect(mockState.applySnapshot).not.toHaveBeenCalled();
    expect(mockState.changeHistoryCreate).not.toHaveBeenCalled();
    expect(request.update).not.toHaveBeenCalled();
  });

  it("applies and records an approved update contribution", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const request = {
      id: "request-1",
      requestType: "update",
      characterId: "character-1",
      update
    };
    mockState.characterFindByPk.mockResolvedValue(character);

    const result = await approvePendingChangeRequest({
      moderatorId: "moderator-1",
      proposedSnapshot: snapshot,
      request: request as never,
      transaction: transaction as never
    });

    expect(mockState.characterFindByPk).toHaveBeenCalledWith("character-1", {
      transaction,
      lock: "UPDATE"
    });
    expect(mockState.calculateCharacterDiff).toHaveBeenCalledWith(snapshot, preparedSnapshot);
    expect(mockState.applySnapshot).toHaveBeenCalledWith(
      character,
      preparedSnapshot,
      "contribution",
      transaction
    );
    expect(mockState.changeHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: "request-1",
        characterId: "character-1"
      }),
      { transaction }
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        proposedSnapshot: preparedSnapshot,
        reviewerId: "moderator-1",
        status: "approved"
      }),
      { transaction }
    );
    expect(result).toEqual({
      character,
      changes: { sourceNote: { old: null, new: "Préparée" } },
      preparedSnapshot
    });
  });

  it("creates the character while approving a creation request", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const request = {
      id: "request-creation",
      requestType: "create",
      characterId: null,
      update
    };

    const result = await approvePendingChangeRequest({
      moderatorId: "moderator-1",
      proposedSnapshot: snapshot,
      request: request as never,
      transaction: transaction as never
    });

    expect(mockState.characterFindByPk).not.toHaveBeenCalled();
    expect(mockState.characterCreate).toHaveBeenCalledOnce();
    expect(mockState.calculateCharacterCreationDiff).toHaveBeenCalledWith(preparedSnapshot);
    expect(mockState.calculateCharacterDiff).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: "character-1", status: "approved" }),
      { transaction }
    );
    expect(result?.changes).toEqual({ firstName: { new: "Camille" } });
  });

  it("applies a direct moderation edit and records its diff", async () => {
    const result = await applyDirectCharacterEdit({
      character: character as never,
      moderatorId: "moderator-1",
      snapshot,
      transaction: transaction as never
    });

    expect(mockState.applySnapshot).toHaveBeenCalledWith(
      character,
      preparedSnapshot,
      "moderation",
      transaction
    );
    expect(mockState.changeHistoryCreate).toHaveBeenCalledWith(
      {
        characterId: "character-1",
        changeRequestId: null,
        moderatorId: "moderator-1",
        changes: { sourceNote: { old: null, new: "Préparée" } }
      },
      { transaction }
    );
    expect(result).toEqual({
      characterId: "character-1",
      changes: { sourceNote: { old: null, new: "Préparée" } }
    });
  });
});
