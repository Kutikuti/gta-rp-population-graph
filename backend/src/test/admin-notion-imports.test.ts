import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMock = {
  LOCK: {
    UPDATE: "UPDATE"
  }
};

const mockState = vi.hoisted(() => ({
  sequelizeTransaction: vi.fn(),
  notionImportEntryFindOne: vi.fn(),
  notionImportEntryFindByPk: vi.fn(),
  characterFindByPk: vi.fn(),
  characterFindAll: vi.fn(),
  characterCreate: vi.fn(),
  changeHistoryCreate: vi.fn(),
  importCandidateFromEntry: vi.fn(),
  serializeImportEntry: vi.fn(),
  serializeImportBatch: vi.fn(),
  loadCharacterTags: vi.fn(),
  relationshipsForCharacter: vi.fn(),
  resolveRelationshipTargets: vi.fn(),
  resolveOrCreateTags: vi.fn(),
  resolveOrCreateStreamerId: vi.fn(),
  syncCharacterTags: vi.fn(),
  syncImportedRelationships: vi.fn(),
  refreshAppliedBatchRelationships: vi.fn(),
  logAdminAction: vi.fn(),
  generateUniqueCharacterSlug: vi.fn(),
  importCharacterPhotoFromRemoteUrl: vi.fn(),
  deleteStoredCharacterPhoto: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  sequelize: {
    transaction: mockState.sequelizeTransaction
  },
  models: {
    NotionImportBatch: {
      findAll: vi.fn(),
      findByPk: vi.fn()
    },
    NotionImportEntry: {
      findOne: mockState.notionImportEntryFindOne,
      findByPk: mockState.notionImportEntryFindByPk
    },
    Character: {
      findByPk: mockState.characterFindByPk,
      findAll: mockState.characterFindAll,
      create: mockState.characterCreate
    },
    ChangeHistory: {
      create: mockState.changeHistoryCreate
    }
  }
}));

vi.mock("../services/admin-notion-imports-shared.js", () => ({
  importCandidateFromEntry: mockState.importCandidateFromEntry,
  serializeImportEntry: mockState.serializeImportEntry,
  serializeImportBatch: mockState.serializeImportBatch,
  setChange: (
    changes: Record<string, unknown>,
    key: string,
    oldValue: unknown,
    newValue: unknown
  ) => {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { old: oldValue, new: newValue };
    }
  }
}));

vi.mock("../services/admin-notion-imports-persistence.js", () => ({
  loadCharacterTags: mockState.loadCharacterTags,
  refreshAppliedBatchRelationships: mockState.refreshAppliedBatchRelationships,
  relationshipsForCharacter: mockState.relationshipsForCharacter,
  resolveOrCreateStreamerId: mockState.resolveOrCreateStreamerId,
  resolveOrCreateTags: mockState.resolveOrCreateTags,
  resolveRelationshipTargets: mockState.resolveRelationshipTargets,
  syncCharacterTags: mockState.syncCharacterTags,
  syncImportedRelationships: mockState.syncImportedRelationships
}));

vi.mock("../services/admin-shared.js", () => ({
  logAdminAction: mockState.logAdminAction
}));

vi.mock("../services/character-slug.js", () => ({
  generateUniqueCharacterSlug: mockState.generateUniqueCharacterSlug
}));

vi.mock("../services/character-photos.js", () => ({
  InvalidCharacterPhotoError: class InvalidCharacterPhotoError extends Error {},
  importCharacterPhotoFromRemoteUrl: mockState.importCharacterPhotoFromRemoteUrl,
  deleteStoredCharacterPhoto: mockState.deleteStoredCharacterPhoto
}));

import { SequelizeAdminNotionImportService } from "../services/admin-notion-imports.js";
import { InvalidCharacterPhotoError } from "../services/character-photos.js";

const service = new SequelizeAdminNotionImportService();

const notionEntryBase = {
  id: "entry-1",
  batchId: "batch-1",
  sourcePageId: "page-ada",
  status: "new",
  appliedCharacterId: null,
  update: vi.fn()
};

const candidateBase = {
  firstName: "Ada",
  lastName: "Lovelace",
  nickname: null,
  lifeStatus: "alive",
  deathOrDepartureDate: null,
  phoneNumber: "555-0101",
  streamerPublicName: "AdaLive",
  socialLinks: { twitch: "https://twitch.example/adalive" },
  businessName: "Laboratoire",
  groupName: "Analystes",
  groupRole: "Lead",
  district: "Downtown",
  isRpDeath: false,
  policeRank: null,
  policeBadgeNumber: null,
  previousCharacters: null,
  verificationStatus: "imported",
  sourceNote: "Import Notion communautaire.",
  tags: ["Tech"],
  relationships: [],
  photoReferences: ["https://www.notion.so/image/test.png"]
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockState.sequelizeTransaction.mockImplementation(async (callback) => callback(transactionMock));
  mockState.importCandidateFromEntry.mockReturnValue(candidateBase);
  mockState.serializeImportEntry.mockImplementation((entry) => ({
    pageId: entry.sourcePageId,
    appliedCharacterId: entry.appliedCharacterId,
    appliedAt: "2026-06-27T00:00:00.000Z"
  }));
  mockState.loadCharacterTags.mockResolvedValue([]);
  mockState.relationshipsForCharacter.mockResolvedValue([]);
  mockState.resolveOrCreateTags.mockResolvedValue([]);
  mockState.resolveOrCreateStreamerId.mockResolvedValue("streamer-1");
  mockState.syncCharacterTags.mockResolvedValue(undefined);
  mockState.syncImportedRelationships.mockResolvedValue(undefined);
  mockState.refreshAppliedBatchRelationships.mockResolvedValue(undefined);
  mockState.logAdminAction.mockResolvedValue(undefined);
  mockState.changeHistoryCreate.mockResolvedValue(undefined);
  mockState.generateUniqueCharacterSlug.mockResolvedValue("ada-lovelace");
  mockState.notionImportEntryFindByPk.mockResolvedValue({
    sourcePageId: "page-ada",
    appliedCharacterId: "character-1"
  });
});

describe("admin notion import service", () => {
  it("blocks apply when several existing characters match the same full name", async () => {
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: null
    });
    mockState.characterFindAll.mockResolvedValue([
      { id: "character-1", firstName: "Ada", lastName: "Lovelace" },
      { id: "character-2", firstName: "Ada", lastName: "Lovelace" }
    ]);

    const result = await service.applyNotionImportEntry({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(result).toMatchObject({
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER",
      details: {
        fullName: "Ada Lovelace",
        characterIds: ["character-1", "character-2"]
      }
    });
    expect(mockState.changeHistoryCreate).not.toHaveBeenCalled();
  });

  it("blocks apply when relationship resolution is ambiguous", async () => {
    const existingCharacter = {
      id: "character-1",
      firstName: "Ada",
      lastName: "Lovelace",
      publicSlug: "ada-lovelace",
      update: vi.fn()
    };
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: null
    });
    mockState.characterFindAll.mockResolvedValue([existingCharacter]);
    mockState.resolveRelationshipTargets.mockResolvedValue({
      resolved: [],
      unresolved: [],
      ambiguous: ["couple: Grace Hopper"]
    });

    const result = await service.applyNotionImportEntry({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(result).toMatchObject({
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS",
      details: {
        ambiguous: ["couple: Grace Hopper"]
      }
    });
    expect(existingCharacter.update).not.toHaveBeenCalled();
    expect(mockState.changeHistoryCreate).not.toHaveBeenCalled();
  });

  it("regenerates the public slug when an applied import changes the character name", async () => {
    const characterUpdate = vi.fn().mockResolvedValue(undefined);
    const entryUpdate = vi.fn().mockResolvedValue(undefined);
    const existingCharacter = {
      id: "character-1",
      firstName: "Ada",
      lastName: "Byron",
      nickname: "Countess",
      lifeStatus: "alive",
      deathOrDepartureDate: null,
      phoneNumber: "555-0000",
      businessName: "Ancien labo",
      groupName: "Anciens",
      groupRole: "Membre",
      district: "Oldtown",
      isRpDeath: false,
      policeRank: null,
      policeBadgeNumber: null,
      previousCharacters: null,
      verificationStatus: "to_check",
      sourceNote: "Ancienne source.",
      socialLinks: { twitch: "https://twitch.example/old" },
      publicSlug: "ada-byron",
      update: characterUpdate
    };

    mockState.importCandidateFromEntry.mockReturnValue({
      ...candidateBase,
      lastName: "Lovelace",
      tags: ["Famille"],
      relationships: [{ type: "parent", targetName: "Victor Lovelace" }]
    });
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: existingCharacter.id,
      update: entryUpdate
    });
    mockState.characterFindByPk.mockResolvedValue(existingCharacter);
    mockState.loadCharacterTags.mockResolvedValue([{ name: "Ancien Tag" }]);
    mockState.relationshipsForCharacter.mockResolvedValue([
      { type: "sibling", target: "Byron Lovelace" }
    ]);
    mockState.resolveRelationshipTargets.mockResolvedValue({
      resolved: [
        {
          type: "parent",
          targetName: "Victor Lovelace",
          targetCharacterId: "character-2"
        }
      ],
      unresolved: [],
      ambiguous: []
    });
    mockState.resolveOrCreateTags.mockResolvedValue([{ id: "tag-1", name: "Famille" }]);
    mockState.generateUniqueCharacterSlug.mockResolvedValue("ada-lovelace");
    mockState.notionImportEntryFindByPk.mockResolvedValue({
      sourcePageId: "page-ada",
      appliedCharacterId: existingCharacter.id
    });

    const result = await service.applyNotionImportEntry({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(mockState.generateUniqueCharacterSlug).toHaveBeenCalledWith(
      "Ada",
      "Lovelace",
      transactionMock,
      existingCharacter.id
    );
    expect(characterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        publicSlug: "ada-lovelace",
        firstName: "Ada",
        lastName: "Lovelace"
      }),
      { transaction: transactionMock }
    );
    expect(mockState.changeHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: existingCharacter.id,
        changes: expect.objectContaining({
          lastName: { old: "Byron", new: "Lovelace" },
          tags: { old: ["Ancien Tag"], new: ["Famille"] }
        })
      }),
      { transaction: transactionMock }
    );
    expect(entryUpdate).toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "applied",
      characterId: existingCharacter.id,
      created: false,
      entry: {
        pageId: "page-ada",
        appliedCharacterId: existingCharacter.id
      }
    });
  });

  it("blocks notion photo import while the entry is not yet applied", async () => {
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: null
    });

    const result = await service.importNotionImportEntryPhoto({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(result).toMatchObject({
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY"
    });
    expect(mockState.importCharacterPhotoFromRemoteUrl).not.toHaveBeenCalled();
  });

  it("blocks notion photo import when no usable photo reference exists", async () => {
    mockState.importCandidateFromEntry.mockReturnValue({
      ...candidateBase,
      photoReferences: []
    });
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: "character-1"
    });

    const result = await service.importNotionImportEntryPhoto({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(result).toMatchObject({
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_NO_PHOTO"
    });
    expect(mockState.importCharacterPhotoFromRemoteUrl).not.toHaveBeenCalled();
  });

  it("returns a validation error when the downloaded notion photo is rejected", async () => {
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: "character-1"
    });
    mockState.importCharacterPhotoFromRemoteUrl.mockRejectedValue(
      new InvalidCharacterPhotoError("Image invalide.")
    );

    const result = await service.importNotionImportEntryPhoto({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(result).toMatchObject({
      status: "invalid",
      code: "NOTION_IMPORT_ENTRY_INVALID_PHOTO",
      message: "Image invalide."
    });
  });

  it("deletes the previous stored photo after a successful notion photo import", async () => {
    const characterUpdate = vi.fn().mockResolvedValue(undefined);

    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: "character-1"
    });
    mockState.importCharacterPhotoFromRemoteUrl.mockResolvedValue("/uploads/characters/new.webp");
    mockState.notionImportEntryFindByPk.mockResolvedValue({
      id: notionEntryBase.id,
      sourcePageId: notionEntryBase.sourcePageId,
      appliedCharacterId: "character-1"
    });
    mockState.characterFindByPk.mockResolvedValue({
      id: "character-1",
      photoUrl: "/uploads/characters/old.webp",
      update: characterUpdate
    });

    const result = await service.importNotionImportEntryPhoto({
      actorUserId: "admin-1",
      batchId: "batch-1",
      pageId: "page-ada"
    });

    expect(characterUpdate).toHaveBeenCalledWith(
      { photoUrl: "/uploads/characters/new.webp" },
      { transaction: transactionMock }
    );
    expect(mockState.changeHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        changes: {
          photoUrl: {
            old: "/uploads/characters/old.webp",
            new: "/uploads/characters/new.webp"
          }
        }
      }),
      { transaction: transactionMock }
    );
    expect(mockState.deleteStoredCharacterPhoto).toHaveBeenCalledWith(
      "/uploads/characters/old.webp"
    );
    expect(result).toMatchObject({
      status: "imported",
      characterId: "character-1",
      photoUrl: "/uploads/characters/new.webp"
    });
  });

  it("deletes the newly imported photo if the transaction fails afterwards", async () => {
    mockState.notionImportEntryFindOne.mockResolvedValue({
      ...notionEntryBase,
      appliedCharacterId: "character-1"
    });
    mockState.importCharacterPhotoFromRemoteUrl.mockResolvedValue("/uploads/characters/new.webp");
    mockState.sequelizeTransaction.mockRejectedValueOnce(new Error("db failure"));

    await expect(
      service.importNotionImportEntryPhoto({
        actorUserId: "admin-1",
        batchId: "batch-1",
        pageId: "page-ada"
      })
    ).rejects.toThrow("db failure");

    expect(mockState.deleteStoredCharacterPhoto).toHaveBeenCalledWith(
      "/uploads/characters/new.webp"
    );
  });
});
