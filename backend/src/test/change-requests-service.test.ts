import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  applyDirectCharacterCreation: vi.fn(),
  applyDirectCharacterEdit: vi.fn(),
  approvePendingChangeRequest: vi.fn(),
  assertPendingCharacterPhotoExists: vi.fn(),
  changeRequestCreate: vi.fn(),
  changeRequestFindAll: vi.fn(),
  changeRequestFindByPk: vi.fn(),
  changeRequestFindOne: vi.fn(),
  characterFindByPk: vi.fn(),
  deletePendingCharacterPhoto: vi.fn(),
  hasExactNameDuplicate: vi.fn(),
  isPendingCharacterPhotoToken: vi.fn(),
  reloadChangeRequestSummary: vi.fn(),
  sequelizeTransaction: vi.fn(),
  serializeChangeRequests: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    ChangeRequest: {
      create: mockState.changeRequestCreate,
      findAll: mockState.changeRequestFindAll,
      findByPk: mockState.changeRequestFindByPk,
      findOne: mockState.changeRequestFindOne
    },
    Character: {
      findByPk: mockState.characterFindByPk
    }
  },
  sequelize: {
    transaction: mockState.sequelizeTransaction
  }
}));

vi.mock("../services/change-request-mutations.js", () => ({
  applyDirectCharacterCreation: mockState.applyDirectCharacterCreation,
  applyDirectCharacterEdit: mockState.applyDirectCharacterEdit,
  approvePendingChangeRequest: mockState.approvePendingChangeRequest
}));

vi.mock("../services/change-request-summaries.js", () => ({
  hasExactNameDuplicate: mockState.hasExactNameDuplicate,
  reloadChangeRequestSummary: mockState.reloadChangeRequestSummary,
  requestInclude: [],
  serializeChangeRequests: mockState.serializeChangeRequests
}));

vi.mock("../services/character-photos.js", () => ({
  assertPendingCharacterPhotoExists: mockState.assertPendingCharacterPhotoExists,
  deletePendingCharacterPhoto: mockState.deletePendingCharacterPhoto,
  InvalidCharacterPhotoError: class InvalidCharacterPhotoError extends Error {},
  isPendingCharacterPhotoToken: mockState.isPendingCharacterPhotoToken
}));

import {
  type CharacterSnapshot,
  SequelizeChangeRequestService
} from "../services/change-requests.js";

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

const creationContext = {
  q: "Camille Morel",
  company: null,
  lifeStatus: null,
  tag: null,
  streamer: null,
  twitchLive: null,
  verificationStatus: null,
  matchTotal: 0
};

const transaction = { LOCK: { UPDATE: "UPDATE" } };

describe("SequelizeChangeRequestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.sequelizeTransaction.mockImplementation(
      async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)
    );
    mockState.hasExactNameDuplicate.mockResolvedValue(false);
    mockState.isPendingCharacterPhotoToken.mockReturnValue(false);
    mockState.reloadChangeRequestSummary.mockResolvedValue({ id: "request-1" });
  });

  it("creates an update request only for an existing character", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.characterFindByPk
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "character-1" });
    mockState.changeRequestCreate.mockResolvedValue({ id: "request-1" });

    await expect(
      service.createChangeRequest({
        userId: "user-1",
        characterId: "missing",
        proposedSnapshot: snapshot
      })
    ).resolves.toBeNull();

    await expect(
      service.createChangeRequest({
        userId: "user-1",
        characterId: "character-1",
        proposedSnapshot: snapshot
      })
    ).resolves.toEqual({ id: "request-1" });
    expect(mockState.changeRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        requestType: "update",
        status: "pending",
        userId: "user-1"
      })
    );
  });

  it("validates pending photos before creating an update request", async () => {
    const service = new SequelizeChangeRequestService();
    const pendingSnapshot = { ...snapshot, photoUrl: "pending-photo:token" };
    mockState.characterFindByPk.mockResolvedValue({ id: "character-1" });
    mockState.changeRequestCreate.mockResolvedValue({ id: "request-1" });
    mockState.isPendingCharacterPhotoToken.mockReturnValue(true);

    await service.createChangeRequest({
      userId: "user-1",
      characterId: "character-1",
      proposedSnapshot: pendingSnapshot
    });

    expect(mockState.assertPendingCharacterPhotoExists).toHaveBeenCalledWith(
      pendingSnapshot.photoUrl,
      "user-1"
    );
  });

  it("reports a dedicated error when an update request cannot be reloaded after creation", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.characterFindByPk.mockResolvedValue({ id: "character-1" });
    mockState.changeRequestCreate.mockResolvedValue({ id: "request-1" });
    mockState.reloadChangeRequestSummary.mockResolvedValue(null);

    await expect(
      service.createChangeRequest({
        userId: "user-1",
        characterId: "character-1",
        proposedSnapshot: snapshot
      })
    ).rejects.toMatchObject({
      status: 500,
      code: "CHANGE_REQUEST_RELOAD_FAILED"
    });
  });

  it("rejects photos and exact duplicates on character creation requests", async () => {
    const service = new SequelizeChangeRequestService();

    await expect(
      service.createCharacterCreationRequest({
        userId: "user-1",
        proposedSnapshot: { ...snapshot, photoUrl: "/uploads/photo.webp" },
        searchContext: creationContext
      })
    ).rejects.toThrow("La photo est disponible uniquement sur une fiche existante.");

    mockState.hasExactNameDuplicate.mockResolvedValue(true);
    await expect(
      service.createCharacterCreationRequest({
        userId: "user-1",
        proposedSnapshot: snapshot,
        searchContext: creationContext
      })
    ).resolves.toBe("duplicate");
  });

  it("creates and reloads a character creation request", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.changeRequestCreate.mockResolvedValue({ id: "request-1" });

    await expect(
      service.createCharacterCreationRequest({
        userId: "user-1",
        proposedSnapshot: snapshot,
        searchContext: creationContext
      })
    ).resolves.toEqual({ id: "request-1" });
    expect(mockState.changeRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: null,
        requestType: "create",
        status: "pending"
      })
    );
  });

  it("reports a dedicated error when a creation request cannot be reloaded", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.changeRequestCreate.mockResolvedValue({ id: "request-1" });
    mockState.reloadChangeRequestSummary.mockResolvedValue(null);

    await expect(
      service.createCharacterCreationRequest({
        userId: "user-1",
        proposedSnapshot: snapshot,
        searchContext: creationContext
      })
    ).rejects.toMatchObject({
      status: 500,
      code: "CHANGE_REQUEST_RELOAD_FAILED"
    });
  });

  it("serializes user and moderation request lists with the expected filters", async () => {
    const service = new SequelizeChangeRequestService();
    const rows = [{ id: "request-1" }];
    mockState.changeRequestFindAll.mockResolvedValue(rows);
    mockState.serializeChangeRequests.mockReturnValue([{ id: "serialized" }]);

    await expect(service.listUserChangeRequests("user-1")).resolves.toEqual([{ id: "serialized" }]);
    expect(mockState.changeRequestFindAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );

    await service.listModerationChangeRequests("pending");
    expect(mockState.changeRequestFindAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "pending" } })
    );
    expect(mockState.serializeChangeRequests).toHaveBeenCalledWith(rows);
  });

  it("approves only pending requests and returns the persisted summary", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.changeRequestFindByPk
      .mockResolvedValueOnce({ status: "approved" })
      .mockResolvedValueOnce({
        id: "request-1",
        status: "pending",
        proposedSnapshot: snapshot
      });

    await expect(
      service.approveChangeRequest({ id: "request-1", moderatorId: "moderator-1" })
    ).resolves.toBeNull();

    mockState.approvePendingChangeRequest.mockResolvedValue({ changes: { firstName: {} } });
    await expect(
      service.approveChangeRequest({ id: "request-1", moderatorId: "moderator-1" })
    ).resolves.toEqual({
      request: { id: "request-1" },
      changes: { firstName: {} }
    });
  });

  it("reports a dedicated error when an approved request cannot be reloaded", async () => {
    const service = new SequelizeChangeRequestService();
    mockState.changeRequestFindByPk.mockResolvedValue({
      id: "request-1",
      status: "pending",
      proposedSnapshot: snapshot
    });
    mockState.approvePendingChangeRequest.mockResolvedValue({ changes: { firstName: {} } });
    mockState.reloadChangeRequestSummary.mockResolvedValue(null);

    await expect(
      service.approveChangeRequest({ id: "request-1", moderatorId: "moderator-1" })
    ).rejects.toMatchObject({
      status: 500,
      code: "CHANGE_REQUEST_RELOAD_FAILED"
    });
  });

  it("cleans a pending photo and records a rejection", async () => {
    const service = new SequelizeChangeRequestService();
    const update = vi.fn().mockResolvedValue(undefined);
    mockState.changeRequestFindOne.mockResolvedValue({
      id: "request-1",
      proposedSnapshot: { ...snapshot, photoUrl: "pending-photo:token" },
      update
    });

    await expect(
      service.rejectChangeRequest({
        id: "request-1",
        moderatorId: "moderator-1",
        comment: "Source insuffisante"
      })
    ).resolves.toEqual({ id: "request-1" });
    expect(mockState.deletePendingCharacterPhoto).toHaveBeenCalledWith("pending-photo:token");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        moderatorComment: "Source insuffisante",
        reviewerId: "moderator-1",
        status: "rejected"
      })
    );
  });

  it("delegates direct edits and creations inside a transaction", async () => {
    const service = new SequelizeChangeRequestService();
    const character = { id: "character-1" };
    mockState.characterFindByPk.mockResolvedValue(character);
    mockState.applyDirectCharacterEdit.mockResolvedValue({
      characterId: "character-1",
      changes: {}
    });
    mockState.applyDirectCharacterCreation.mockResolvedValue({
      characterId: "character-2",
      changes: {}
    });

    await service.editCharacterDirectly({
      characterId: "character-1",
      moderatorId: "moderator-1",
      snapshot
    });
    expect(mockState.applyDirectCharacterEdit).toHaveBeenCalledWith({
      character,
      moderatorId: "moderator-1",
      snapshot,
      transaction
    });

    await service.createCharacterDirectly({ moderatorId: "moderator-1", snapshot });
    expect(mockState.applyDirectCharacterCreation).toHaveBeenCalledWith({
      moderatorId: "moderator-1",
      snapshot,
      transaction
    });
  });
});
