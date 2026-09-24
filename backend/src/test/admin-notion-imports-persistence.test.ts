import { Op } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  destroy: vi.fn(),
  findAll: vi.fn(),
  bulkCreate: vi.fn(),
  tagFindAll: vi.fn(),
  tagCreate: vi.fn()
}));

vi.mock("../db/index.js", () => ({
  models: {
    Tag: {
      findAll: mockState.tagFindAll,
      create: mockState.tagCreate
    },
    CharacterRelationship: {
      destroy: mockState.destroy,
      findAll: mockState.findAll,
      bulkCreate: mockState.bulkCreate
    }
  }
}));

import {
  resolveOrCreateTags,
  syncImportedRelationships
} from "../services/admin-notion-imports-persistence.js";

describe("syncImportedRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.tagFindAll.mockResolvedValue([]);
    mockState.tagCreate.mockImplementation(async (values) => ({ id: "created", ...values }));
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

describe("resolveOrCreateTags exact matching", () => {
  it.each(["Percent%Tag", "under_score", "back\\slash"])(
    "does not attach a neighboring tag for imported name %s",
    async (name) => {
      const nearMatch = { id: "near", name: name.replace(/[\\%_]/gu, "x") };
      const exactMatch = { id: "exact", name: name.toUpperCase() };
      mockState.tagFindAll.mockResolvedValue([nearMatch, exactMatch]);

      const resolved = await resolveOrCreateTags([name], {} as never);

      expect(resolved).toEqual([exactMatch]);
      expect(mockState.tagCreate).not.toHaveBeenCalled();
      const query = mockState.tagFindAll.mock.calls[0]?.[0] as {
        where: { [Op.or]: Array<{ name: { [Op.iLike]: string } }> };
      };
      expect(query.where[Op.or][0]?.name[Op.iLike]).toBe(name.replace(/[\\%_]/gu, "\\$&"));
    }
  );

  it("creates an exact tag instead of associating a wildcard-only near match", async () => {
    mockState.tagFindAll.mockResolvedValue([{ id: "near", name: "AlphaXBeta" }]);

    const resolved = await resolveOrCreateTags(["Alpha%Beta"], {} as never);

    expect(resolved).toEqual([expect.objectContaining({ id: "created", name: "Alpha%Beta" })]);
    expect(mockState.tagCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alpha%Beta" }),
      { transaction: expect.anything() }
    );
  });
});
