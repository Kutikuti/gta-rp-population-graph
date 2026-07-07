import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  destroy: vi.fn(),
  findAll: vi.fn(),
  bulkCreate: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    CharacterRelationship: {
      destroy: mockState.destroy,
      findAll: mockState.findAll,
      bulkCreate: mockState.bulkCreate
    }
  }
}));

import { syncImportedRelationships } from "../services/admin-notion-imports-persistence.js";

describe("syncImportedRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.destroy.mockResolvedValue(0);
    mockState.findAll.mockResolvedValue([]);
    mockState.bulkCreate.mockResolvedValue([]);
  });

  it("does not recreate a parent link when the inverse child import resolves to the same canonical relationship", async () => {
    mockState.findAll.mockResolvedValue([
      {
        sourceCharacterId: "jada",
        targetCharacterId: "desmond",
        type: "parent",
        direction: "directed"
      }
    ]);

    await syncImportedRelationships(
      "desmond",
      [
        {
          type: "child",
          targetName: "Jada Campbell",
          targetCharacterId: "jada"
        }
      ],
      "imported",
      {} as never
    );

    expect(mockState.bulkCreate).not.toHaveBeenCalled();
  });
});
