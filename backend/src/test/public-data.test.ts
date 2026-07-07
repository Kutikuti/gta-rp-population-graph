import { afterEach, describe, expect, it, vi } from "vitest";

import { models } from "../db/index.js";
import { SequelizePublicDataService } from "../services/public-data.js";

describe("SequelizePublicDataService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates inverse parent and child links on a character sheet", async () => {
    vi.spyOn(models.Character, "findOne").mockResolvedValue({
      id: "desmond",
      publicSlug: "desmond-campbell",
      firstName: "Desmond",
      lastName: "Campbell",
      nickname: null,
      birthDate: null,
      lifeStatus: "alive",
      deathOrDepartureDate: null,
      photoUrl: null,
      companyName: null,
      companyRank: null,
      companyBadgeNumber: null,
      phoneNumbers: [],
      groupName: null,
      district: null,
      isRpDeath: false,
      previousCharacters: null,
      verificationStatus: "community",
      dataSource: "notion",
      sourceNote: null,
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
      updatedAt: new Date("2026-07-07T00:00:00.000Z"),
      streamer: null,
      tags: [],
      outgoingRelationships: [
        {
          id: "rel-parent",
          sourceCharacterId: "desmond",
          targetCharacterId: "victor",
          type: "parent",
          direction: "directed",
          label: "Parent",
          description: null,
          source: "notion",
          verificationStatus: "imported",
          targetCharacter: {
            id: "victor",
            firstName: "Victor",
            lastName: "Campbell"
          }
        }
      ],
      incomingRelationships: [
        {
          id: "rel-child",
          sourceCharacterId: "victor",
          targetCharacterId: "desmond",
          type: "child",
          direction: "directed",
          label: "Enfant",
          description: null,
          source: "notion",
          verificationStatus: "imported",
          sourceCharacter: {
            id: "victor",
            firstName: "Victor",
            lastName: "Campbell"
          }
        }
      ]
    } as never);

    const service = new SequelizePublicDataService({
      getStatusForSocialLinks: vi.fn().mockResolvedValue("unknown")
    } as never);

    const result = await service.getCharacter("desmond-campbell");

    expect(result?.relationships.outgoing).toEqual([
      expect.objectContaining({
        type: "parent",
        label: "Parent",
        relatedCharacter: expect.objectContaining({
          id: "victor",
          fullName: "Victor Campbell"
        })
      })
    ]);
    expect(result?.relationships.incoming).toEqual([]);
  });

  it("deduplicates inverse parent and child edges in the graph", async () => {
    vi.spyOn(models.Character, "findAll").mockResolvedValue([] as never);
    vi.spyOn(models.CharacterRelationship, "findAll").mockResolvedValue([
      {
        id: "rel-parent",
        sourceCharacterId: "desmond",
        targetCharacterId: "victor",
        type: "parent",
        direction: "directed",
        verificationStatus: "imported"
      },
      {
        id: "rel-child",
        sourceCharacterId: "victor",
        targetCharacterId: "desmond",
        type: "child",
        direction: "directed",
        verificationStatus: "imported"
      }
    ] as never);

    const service = new SequelizePublicDataService();
    const graph = await service.getGraph();

    expect(graph.edges).toEqual([
      {
        data: {
          id: "rel-parent",
          type: "relationship",
          source: "desmond",
          target: "victor",
          label: "Parent",
          relationshipType: "parent",
          direction: "directed",
          verificationStatus: "imported"
        }
      }
    ]);
  });
});
