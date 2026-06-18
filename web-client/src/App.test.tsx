import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./GraphView", () => ({
  default: ({ selectedId }: { selectedId: string | null }) => (
    <div aria-label="Graphe interactif des personnages">Graphe mock {selectedId}</div>
  )
}));

const now = "2026-06-17T12:00:00.000Z";

const tag = {
  id: "00000000-0000-4000-8000-000000000403",
  name: "Famille Morel",
  type: "family",
  colorHex: "#7bb7ff",
  description: "Lien familial fictif."
};

const camille = {
  id: "00000000-0000-4000-8000-000000000301",
  firstName: "Camille",
  lastName: "Morel",
  fullName: "Camille Morel",
  nickname: "Cami",
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
    verificationStatus: "community"
  },
  tags: [tag],
  updatedAt: now
};

const ines = {
  ...camille,
  id: "00000000-0000-4000-8000-000000000303",
  firstName: "Ines",
  lastName: "Morel",
  fullName: "Ines Morel",
  nickname: null,
  phoneNumber: null,
  streamer: null,
  verificationStatus: "to_check"
};

const camilleDetail = {
  ...camille,
  birthDate: null,
  deathOrDepartureDate: null,
  photoUrl: null,
  businessRank: "Responsable planning",
  socialLinks: null,
  isRpDeath: false,
  previousCharacters: { v5: "Nom inconnu" },
  sourceNote: "Donnee fictive.",
  relationships: {
    outgoing: [
      {
        id: "00000000-0000-4000-8000-000000000501",
        sourceCharacterId: camille.id,
        targetCharacterId: ines.id,
        type: "sibling",
        direction: "symmetric",
        label: "Soeurs",
        description: null,
        source: "seed",
        verificationStatus: "community",
        relatedCharacter: {
          id: ines.id,
          firstName: ines.firstName,
          lastName: ines.lastName,
          fullName: ines.fullName
        }
      }
    ],
    incoming: []
  },
  createdAt: now
};

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body)
  } as Response);

const errorResponse = (status = 500) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({})
  } as Response);

describe("App", () => {
  beforeEach(() => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/tags")) {
        return jsonResponse([tag]);
      }

      if (url.includes("/api/graph")) {
        return jsonResponse({
          nodes: [camille, ines].map((character) => ({
            data: {
              id: character.id,
              type: "character",
              label: character.fullName,
              characterId: character.id,
              fullName: character.fullName,
              lifeStatus: character.lifeStatus,
              verificationStatus: character.verificationStatus,
              streamerName: character.streamer?.publicName ?? null,
              tagIds: character.tags.map((item) => item.id)
            }
          })),
          edges: [
            {
              data: {
                id: "00000000-0000-4000-8000-000000000501",
                type: "relationship",
                source: camille.id,
                target: ines.id,
                label: "Soeurs",
                relationshipType: "sibling",
                direction: "symmetric",
                verificationStatus: "community"
              }
            }
          ]
        });
      }

      if (url.includes(`/api/characters/${camille.id}`)) {
        return jsonResponse(camilleDetail);
      }

      if (url.includes("/api/history")) {
        return jsonResponse([]);
      }

      if (url.includes("/api/characters?")) {
        return jsonResponse({
          items: url.includes("q=ines") ? [ines] : [camille, ines],
          total: url.includes("q=ines") ? 1 : 2,
          limit: 100,
          offset: 0
        });
      }

      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders public data, filters results and opens a character sheet", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "GTA-RP Population Graph" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Camille Morel/ })).toBeInTheDocument();
    });

    expect(screen.getByText("2 personnages")).toBeInTheDocument();
    expect(await screen.findByLabelText("Graphe interactif des personnages")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Camille Morel" })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom, telephone, matricule..."), "ines");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ines Morel/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Camille Morel/ })).not.toBeInTheDocument();
    });
  });

  it("shows an API error instead of an endless graph loader", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/tags") || url.includes("/api/graph")) {
        return errorResponse();
      }

      if (url.includes("/api/characters?")) {
        return jsonResponse({ items: [], total: 0, limit: 100, offset: 0 });
      }

      return errorResponse(404);
    });

    render(<App />);

    expect(await screen.findByText("Impossible de charger les donnees publiques.")).toBeInTheDocument();
    expect(screen.queryByText("Chargement du graphe...")).not.toBeInTheDocument();
  });
});
