import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type {
  CharacterListFilters,
  CharacterMatchFilters,
  HistoryFilters,
  PublicCharacterDetail,
  PublicCharacterList,
  PublicCharacterMatches,
  PublicCharacterReference,
  PublicCharacterSummary,
  PublicDataService,
  PublicGraph,
  PublicHistoryEntry,
  PublicStreamer,
  PublicTag
} from "../services/public-data.js";

type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

const now = new Date("2026-06-16T12:00:00.000Z").toISOString();

const tags: PublicTag[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    name: "Quartier Nord",
    type: "district",
    colorHex: "#2f9bff",
    description: "Groupe geographique fictif."
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    name: "Blue Line Logistics",
    type: "business",
    colorHex: "#38c7ff",
    description: "Entreprise fictive."
  }
];

const streamers: PublicStreamer[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    publicName: "NovaRP",
    primaryPlatform: "twitch",
    socialLinks: { twitch: "https://twitch.tv/example-novarp" },
    twitchLiveStatus: "unknown",
    verificationStatus: "community"
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    publicName: "AxleLive",
    primaryPlatform: "twitch",
    socialLinks: { twitch: "https://twitch.tv/example-axlelive" },
    twitchLiveStatus: "unknown",
    verificationStatus: "community"
  }
];

const camille: PublicCharacterSummary = {
  id: "00000000-0000-4000-8000-000000000301",
  publicSlug: "camille-morel",
  firstName: "Camille",
  lastName: "Morel",
  fullName: "Camille Morel",
  nickname: "Cami",
  photoUrl: null,
  lifeStatus: "alive",
  phoneNumber: "555-0101",
  businessName: "Blue Line Logistics",
  businessBadgeNumber: "BL-17",
  policeRank: null,
  policeBadgeNumber: null,
  groupName: "Quartier Nord",
  groupRole: "Mediatrice",
  district: "Nord",
  verificationStatus: "community",
  dataSource: "seed",
  streamer: {
    id: "00000000-0000-4000-8000-000000000201",
    publicName: "NovaRP",
    primaryPlatform: "twitch",
    socialLinks: { twitch: "https://twitch.tv/example-novarp" },
    twitchLiveStatus: "live",
    verificationStatus: "community"
  },
  tags,
  updatedAt: now
};

const malik: PublicCharacterSummary = {
  ...camille,
  id: "00000000-0000-4000-8000-000000000302",
  publicSlug: "malik-serrano",
  firstName: "Malik",
  lastName: "Serrano",
  fullName: "Malik Serrano",
  nickname: "Serrano",
  phoneNumber: "555-0102",
  businessBadgeNumber: "BL-23",
  streamer: {
    id: "00000000-0000-4000-8000-000000000202",
    publicName: "AxleLive",
    primaryPlatform: "twitch",
    socialLinks: { twitch: "https://twitch.tv/example-axlelive" },
    twitchLiveStatus: "unknown",
    verificationStatus: "community"
  }
};

const camilleDetail: PublicCharacterDetail = {
  ...camille,
  birthDate: null,
  deathOrDepartureDate: null,
  photoUrl: null,
  businessRank: "Responsable planning",
  socialLinks: null,
  twitchLiveStatus: "live",
  isRpDeath: false,
  previousCharacters: { v5: "Nom inconnu" },
  sourceNote: "Donnee fictive de developpement.",
  relationships: {
    outgoing: [
      {
        id: "00000000-0000-4000-8000-000000000501",
        sourceCharacterId: camille.id,
        targetCharacterId: malik.id,
        type: "sibling",
        graphVisible: true,
        direction: "symmetric",
        label: "Fratrie",
        description: "Relation familiale fictive.",
        source: "seed",
        verificationStatus: "community",
        relatedCharacter: {
          id: malik.id,
          firstName: malik.firstName,
          lastName: malik.lastName,
          fullName: malik.fullName
        }
      }
    ],
    incoming: []
  },
  createdAt: now
};

const graph: PublicGraph = {
  nodes: [camille, malik].map((character) => ({
    data: {
      id: character.id,
      type: "character",
      label: character.fullName,
      characterId: character.id,
      fullName: character.fullName,
      lifeStatus: character.lifeStatus,
      verificationStatus: character.verificationStatus,
      photoUrl: character.photoUrl,
      streamerName: character.streamer?.publicName ?? null,
      tagIds: character.tags.map((tag) => tag.id)
    }
  })),
  edges: [
    {
      data: {
        id: "00000000-0000-4000-8000-000000000501",
        type: "relationship",
        source: camille.id,
        target: malik.id,
        label: "Fratrie",
        relationshipType: "sibling",
        direction: "symmetric",
        verificationStatus: "community"
      }
    }
  ]
};

const history: PublicHistoryEntry[] = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    characterId: camille.id,
    characterName: camille.fullName,
    changes: { lifeStatus: { from: "unknown", to: "alive" } },
    createdAt: now
  }
];

const directory: PublicCharacterReference[] = [
  { id: camille.id, publicSlug: camille.publicSlug, fullName: camille.fullName },
  { id: malik.id, publicSlug: malik.publicSlug, fullName: malik.fullName }
];

const filterCharacters = (filters: CharacterMatchFilters) =>
  [camille, malik].filter((character) => {
    const query = filters.q?.toLocaleLowerCase("fr-FR");
    const matchesQuery = query
      ? [
          character.fullName,
          character.nickname,
          character.phoneNumber,
          character.businessBadgeNumber
        ]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase("fr-FR").includes(query))
      : true;
    const matchesLifeStatus = filters.lifeStatus
      ? character.lifeStatus === filters.lifeStatus
      : true;
    const matchesTag = filters.tag
      ? character.tags.some((tag) => tag.name === filters.tag || tag.id === filters.tag)
      : true;
    const matchesStreamer = filters.streamer
      ? character.streamer?.publicName === filters.streamer ||
        character.streamer?.id === filters.streamer
      : true;

    return matchesQuery && matchesLifeStatus && matchesTag && matchesStreamer;
  });

const createFixtureService = (): PublicDataService => ({
  listCharacters(filters: CharacterListFilters) {
    const items = filterCharacters(filters);

    return Promise.resolve({
      items: items.slice(filters.offset, filters.offset + filters.limit),
      total: items.length,
      limit: filters.limit,
      offset: filters.offset
    });
  },
  listCharacterDirectory() {
    return Promise.resolve(directory);
  },
  listCharacterMatches(filters: CharacterMatchFilters) {
    const items = filterCharacters(filters);

    return Promise.resolve({
      ids: items.map((character) => character.id),
      total: items.length
    });
  },
  getCharacter(id: string) {
    return Promise.resolve(
      id === camilleDetail.id || id === camilleDetail.publicSlug ? camilleDetail : null
    );
  },
  listTags() {
    return Promise.resolve(tags);
  },
  listStreamers() {
    return Promise.resolve(streamers);
  },
  getGraph() {
    return Promise.resolve(graph);
  },
  listHistory(filters: HistoryFilters) {
    return Promise.resolve(
      filters.characterId
        ? history.filter((entry) => entry.characterId === filters.characterId)
        : history
    );
  }
});

const app = createApp({ publicDataService: createFixtureService() });

describe("public consultation API", () => {
  it("lists characters with search and filters", async () => {
    const response = await request(app)
      .get("/api/characters")
      .query({ q: "BL-17", lifeStatus: "alive", tag: "Quartier Nord", streamer: "NovaRP" });

    expect(response.status).toBe(200);
    const body = response.body as PublicCharacterList;

    expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: camille.id,
      fullName: "Camille Morel",
      streamer: { publicName: "NovaRP" }
    });
  });

  it("returns the public character directory", async () => {
    const response = await request(app).get("/api/characters/directory");

    expect(response.status).toBe(200);
    const body = response.body as PublicCharacterReference[];

    expect(body).toEqual(directory);
  });

  it("returns validation errors for invalid public filters", async () => {
    const response = await request(app).get("/api/characters").query({ lifeStatus: "ghost" });

    expect(response.status).toBe(400);
    const body = response.body as ApiError;

    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns matching character ids without list pagination", async () => {
    const response = await request(app).get("/api/characters/matches").query({ q: "BL-" });

    expect(response.status).toBe(200);
    const body = response.body as PublicCharacterMatches;

    expect(body).toEqual({ ids: [camille.id, malik.id], total: 2 });
  });

  it("returns one detailed character sheet", async () => {
    const response = await request(app).get(`/api/characters/${camille.id}`);

    expect(response.status).toBe(200);
    const body = response.body as PublicCharacterDetail;

    expect(body).toMatchObject({
      id: camille.id,
      fullName: "Camille Morel",
      relationships: {
        outgoing: [{ label: "Fratrie", relatedCharacter: { fullName: "Malik Serrano" } }]
      }
    });
  });

  it("returns one detailed character sheet from the public slug", async () => {
    const response = await request(app).get(`/api/characters/${camille.publicSlug}`);

    expect(response.status).toBe(200);
    const body = response.body as PublicCharacterDetail;

    expect(body).toMatchObject({
      id: camille.id,
      publicSlug: camille.publicSlug,
      fullName: "Camille Morel"
    });
  });

  it("returns 404 when a character does not exist", async () => {
    const response = await request(app).get("/api/characters/00000000-0000-4000-8000-999999999999");

    expect(response.status).toBe(404);
    const body = response.body as ApiError;

    expect(body.error.code).toBe("CHARACTER_NOT_FOUND");
  });

  it("returns tags, streamers, graph elements and public history", async () => {
    const [tagsResponse, streamersResponse, graphResponse, historyResponse] = await Promise.all([
      request(app).get("/api/tags"),
      request(app).get("/api/streamers"),
      request(app).get("/api/graph"),
      request(app).get("/api/history")
    ]);

    expect(tagsResponse.status).toBe(200);
    const tagsBody = tagsResponse.body as PublicTag[];
    const streamersBody = streamersResponse.body as PublicStreamer[];
    const graphBody = graphResponse.body as PublicGraph;
    const historyBody = historyResponse.body as PublicHistoryEntry[];

    expect(tagsBody).toHaveLength(2);
    expect(streamersResponse.status).toBe(200);
    expect(streamersBody).toHaveLength(2);
    expect(graphResponse.status).toBe(200);
    expect(graphBody.nodes).toHaveLength(2);
    expect(graphBody.edges[0]?.data).toMatchObject({
      source: camille.id,
      target: malik.id,
      relationshipType: "sibling"
    });
    expect(historyResponse.status).toBe(200);
    expect(historyBody[0]).toMatchObject({ characterName: "Camille Morel" });
  });

  it("filters public history by character", async () => {
    const [matchingResponse, emptyResponse] = await Promise.all([
      request(app).get("/api/history").query({ characterId: camille.id }),
      request(app).get("/api/history").query({ characterId: malik.id })
    ]);

    expect(matchingResponse.status).toBe(200);
    const matchingBody = matchingResponse.body as PublicHistoryEntry[];
    const emptyBody = emptyResponse.body as PublicHistoryEntry[];

    expect(matchingBody).toHaveLength(1);
    expect(matchingBody[0]).toMatchObject({ characterId: camille.id });

    expect(emptyResponse.status).toBe(200);
    expect(emptyBody).toEqual([]);
  });

  it("returns validation errors for invalid public history filters", async () => {
    const response = await request(app).get("/api/history").query({ characterId: "invalid" });

    expect(response.status).toBe(400);
    const body = response.body as ApiError;

    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
