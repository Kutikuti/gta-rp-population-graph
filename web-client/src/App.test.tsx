import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./GraphView", () => ({
  default: ({
    matchingIds,
    selectedId,
    onSelect
  }: {
    matchingIds: string[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div role="img" aria-label="Graphe interactif des personnages">
      <button
        type="button"
        onClick={() => {
          onSelect("00000000-0000-4000-8000-000000000301");
        }}
      >
        Nœud Camille Morel
      </button>
      <span>Correspondances {matchingIds.join(",")}</span>
      <span>Selection {selectedId}</span>
    </div>
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
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    window.sessionStorage.clear();

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/auth/session")) {
        return jsonResponse({ authenticated: false });
      }

      if (url.includes("/api/auth/logout")) {
        return Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve({})
        } as Response);
      }

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

      if (url.includes("/api/characters/matches")) {
        return jsonResponse({
          ids: url.includes("q=ines") ? [ines.id] : [camille.id, ines.id],
          total: url.includes("q=ines") ? 1 : 2
        });
      }

      if (url.includes("/api/characters?")) {
        return jsonResponse({
          items: url.includes("q=ines") ? [ines] : [camille, ines],
          total: url.includes("q=ines") ? 1 : 2,
          limit: 100,
          offset: 0
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({})
      } as Response);
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
    expect(await screen.findByRole("link", { name: "Connexion Google" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Fiche personnage")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ouvrir la recherche" }));

    expect(await screen.findByLabelText("Graphe interactif des personnages")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Ines Morel/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nœud Camille Morel" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Camille Morel" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Nœud Camille Morel" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Fiche personnage")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Nœud Camille Morel" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Camille Morel" })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom, téléphone, matricule..."), "ines");

    await waitFor(() => {
      expect(screen.getByText(`Correspondances ${ines.id}`)).toBeInTheDocument();
      expect(screen.getByText("1 personnage mis en évidence.")).toBeInTheDocument();
    });
  });

  it("shows an API error instead of an endless graph loader", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/tags") || url.includes("/api/graph")) {
        return errorResponse();
      }

      if (url.includes("/api/characters/matches")) {
        return jsonResponse({ ids: [], total: 0 });
      }

      return errorResponse(404);
    });

    render(<App />);

    expect(
      await screen.findByText("Impossible de charger les données publiques.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Chargement du graphe...")).not.toBeInTheDocument();
  });

  it("starts Google login from the header button", async () => {
    render(<App />);

    expect(await screen.findByRole("link", { name: "Connexion Google" })).toHaveAttribute(
      "href",
      "http://localhost:4000/api/auth/google"
    );
  });

  it("shows the connected user and logs out cleanly", async () => {
    window.history.replaceState({}, "", "/?auth=success");

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: {
            id: "00000000-0000-4000-8000-000000000901",
            email: "viewer@example.test",
            displayName: "Viewer Example",
            avatarUrl: null,
            role: {
              id: "00000000-0000-4000-8000-000000000001",
              name: "user"
            },
            isBanned: false
          }
        });
      }

      if (url.includes("/api/auth/logout")) {
        return Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve({})
        } as Response);
      }

      if (url.includes("/api/tags")) {
        return jsonResponse([tag]);
      }

      if (url.includes("/api/graph")) {
        return jsonResponse({ nodes: [], edges: [] });
      }

      if (url.includes("/api/characters/matches")) {
        return jsonResponse({ ids: [], total: 0 });
      }

      return errorResponse(404);
    });

    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText("Viewer Example")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
    expect(await screen.findByText("Connexion établie.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Déconnexion" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Connexion Google" })).toBeInTheDocument();
    });
    expect(await screen.findByText("Déconnexion effectuée.")).toBeInTheDocument();
  });

  it("shows an auth error returned by the OAuth callback", async () => {
    window.history.replaceState({}, "", "/?auth_error=banned");

    render(<App />);

    expect(
      await screen.findByText("Ce compte n'est pas autorisé à contribuer.")
    ).toBeInTheDocument();
  });

  it("lets a connected user propose a new character after an empty search", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.includes("/api/auth/session")) {
        return jsonResponse({
          authenticated: true,
          user: {
            id: "00000000-0000-4000-8000-000000000901",
            email: "viewer@example.test",
            displayName: "Viewer Example",
            avatarUrl: null,
            role: {
              id: "00000000-0000-4000-8000-000000000001",
              name: "user"
            },
            isBanned: false
          }
        });
      }

      if (url.includes("/api/tags")) {
        return jsonResponse([tag]);
      }

      if (url.includes("/api/graph")) {
        return jsonResponse({ nodes: [], edges: [] });
      }

      if (url.includes("/api/characters/matches")) {
        return jsonResponse({ ids: [], total: 0 });
      }

      if (url.includes("/api/contributions/change-requests/character-creations")) {
        return jsonResponse({
          id: "00000000-0000-4000-8000-000000000801",
          requestType: "create",
          characterId: null,
          characterName: "Nadia Soler",
          userId: "00000000-0000-4000-8000-000000000901",
          userDisplayName: "Viewer Example",
          status: "pending",
          proposedSnapshot: JSON.parse(String(init?.body)).proposedSnapshot,
          searchContext: JSON.parse(String(init?.body)).searchContext,
          reviewerId: null,
          reviewerDisplayName: null,
          moderatorComment: null,
          resolvedAt: null,
          createdAt: now,
          updatedAt: now
        });
      }

      if (url.includes("/api/contributions/change-requests")) {
        return jsonResponse([]);
      }

      return errorResponse(404);
    });

    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Ouvrir la recherche" }));
    await user.type(screen.getByPlaceholderText("Nom, téléphone, matricule..."), "Nadia Soler");

    expect(await screen.findByText("Aucun personnage trouvé.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Proposer une nouvelle fiche" }));

    expect(await screen.findByRole("heading", { name: "Proposer une nouvelle fiche" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Nadia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Soler")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));

    expect(await screen.findByText("Demande envoyée en modération.")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Proposer une nouvelle fiche" })
      ).not.toBeInTheDocument();
    });
  });
});
