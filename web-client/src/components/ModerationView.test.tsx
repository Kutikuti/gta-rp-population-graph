import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  approveChangeRequest: vi.fn(),
  characterToSnapshot: vi.fn(),
  editCharacterDirectly: vi.fn(),
  getCharacter: vi.fn(),
  getModerationDataCompleteness: vi.fn(),
  listCharacterDirectory: vi.fn(),
  listModerationChangeRequests: vi.fn(),
  listStreamers: vi.fn(),
  rejectChangeRequest: vi.fn()
}));

vi.mock("../api", () => apiMocks);

vi.mock("./DataCompletenessPanel", () => ({
  DataCompletenessPanel: ({
    onEditCharacter,
    report,
    title
  }: {
    onEditCharacter?: (slug: string) => void;
    report: unknown;
    title: string;
  }) => (
    <section>
      <span>{title}</span>
      <span>{report ? "Rapport chargé" : "Sans rapport"}</span>
      <button type="button" onClick={() => onEditCharacter?.("camille-morel")}>
        Modifier la fiche incomplète
      </button>
    </section>
  )
}));

vi.mock("./ModerationRequestList", () => ({
  ModerationRequestList: ({
    requests,
    onSelectRequest
  }: {
    requests: Array<{ id: string; characterName: string | null }>;
    onSelectRequest: (id: string) => void;
  }) => (
    <aside>
      {requests.map((request) => (
        <button key={request.id} type="button" onClick={() => onSelectRequest(request.id)}>
          {request.characterName}
        </button>
      ))}
    </aside>
  )
}));

vi.mock("./ModerationDetailPanel", () => ({
  ModerationDetailPanel: ({
    feedback,
    rejectComment,
    selectedRequest,
    onApprove,
    onReject,
    onRejectCommentChange,
    onSubmitDirectEdit
  }: {
    feedback: string | null;
    rejectComment: string;
    selectedRequest: { characterName: string | null } | null;
    onApprove: () => void;
    onReject: () => void;
    onRejectCommentChange: (value: string) => void;
    onSubmitDirectEdit: () => void;
  }) => (
    <section>
      <span>{selectedRequest?.characterName ?? "Aucune sélection"}</span>
      {feedback ? <span>{feedback}</span> : null}
      <button type="button" onClick={onApprove}>
        Accepter
      </button>
      <input
        aria-label="Commentaire de refus"
        value={rejectComment}
        onChange={(event) => onRejectCommentChange(event.target.value)}
      />
      <button type="button" onClick={onReject}>
        Refuser
      </button>
      <button type="button" onClick={onSubmitDirectEdit}>
        Appliquer directement
      </button>
    </section>
  )
}));

import type { AuthSession, ChangeRequestSummary, CharacterSnapshot } from "../api";
import { ModerationView } from "./ModerationView";

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

const pendingRequest: ChangeRequestSummary = {
  id: "request-1",
  requestType: "update",
  characterId: "character-1",
  characterName: "Camille Morel",
  proposedStreamerName: null,
  userId: "user-1",
  userDisplayName: "Contributeur",
  status: "pending",
  proposedSnapshot: snapshot,
  searchContext: null,
  reviewerId: null,
  reviewerDisplayName: null,
  moderatorComment: null,
  resolvedAt: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z"
};

const moderatorSession: AuthSession = {
  authenticated: true,
  user: {
    id: "moderator-1",
    email: "moderator@example.test",
    displayName: "Modérateur",
    mustChooseDisplayName: false,
    avatarUrl: null,
    role: { id: "role-moderator", name: "moderator" },
    isBanned: false,
    linkedIdentities: []
  }
};

const renderView = (overrides?: {
  session?: AuthSession | null;
  onDataChanged?: () => Promise<void>;
  onEditCharacter?: (slug: string) => void;
  onError?: (message: string) => void;
}) => {
  const props = {
    session: moderatorSession,
    onDataChanged: vi.fn(async () => undefined),
    onEditCharacter: vi.fn(),
    onError: vi.fn(),
    ...overrides
  };

  render(<ModerationView {...props} />);
  return props;
};

describe("ModerationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listModerationChangeRequests.mockResolvedValue([pendingRequest]);
    apiMocks.getModerationDataCompleteness.mockResolvedValue({ summary: {}, items: [] });
    apiMocks.listStreamers.mockResolvedValue([]);
    apiMocks.listCharacterDirectory.mockResolvedValue([]);
    apiMocks.getCharacter.mockResolvedValue({ id: "character-1" });
    apiMocks.characterToSnapshot.mockReturnValue(snapshot);
    apiMocks.approveChangeRequest.mockResolvedValue({
      request: { ...pendingRequest, status: "approved" },
      changes: { firstName: { old: "Camille", new: "Camilla" } }
    });
    apiMocks.rejectChangeRequest.mockResolvedValue({ ...pendingRequest, status: "rejected" });
    apiMocks.editCharacterDirectly.mockResolvedValue({
      characterId: "character-1",
      changes: { sourceNote: { old: null, new: "Vérifié" } }
    });
  });

  it("blocks non-moderators without loading moderation data", async () => {
    renderView({ session: { authenticated: false } });

    expect(screen.getByText("Accès réservé aux modérateurs.")).toBeInTheDocument();
    expect(apiMocks.listModerationChangeRequests).not.toHaveBeenCalled();
    expect(apiMocks.getModerationDataCompleteness).not.toHaveBeenCalled();
    expect(apiMocks.listStreamers).not.toHaveBeenCalled();
    expect(apiMocks.listCharacterDirectory).not.toHaveBeenCalled();
  });

  it("loads pending requests, detail data and completeness actions", async () => {
    const onEditCharacter = vi.fn();
    renderView({ onEditCharacter });

    expect(await screen.findByText("Rapport chargé")).toBeInTheDocument();
    expect(await screen.findAllByText("Camille Morel")).toHaveLength(2);
    expect(apiMocks.getCharacter).toHaveBeenCalledWith("character-1");

    await userEvent.click(screen.getByRole("button", { name: "Modifier la fiche incomplète" }));
    expect(onEditCharacter).toHaveBeenCalledWith("camille-morel");
  });

  it("approves a request and refreshes public data", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn(async () => undefined);
    renderView({ onDataChanged });

    await screen.findAllByText("Camille Morel");
    await user.click(screen.getByRole("button", { name: "Accepter" }));

    await waitFor(() => expect(apiMocks.approveChangeRequest).toHaveBeenCalledWith("request-1"));
    expect(onDataChanged).toHaveBeenCalledOnce();
    expect(await screen.findByText("Demande acceptée.")).toBeInTheDocument();
  });

  it("rejects a request with the moderator comment", async () => {
    const user = userEvent.setup();
    renderView();

    await screen.findAllByText("Camille Morel");
    await user.type(screen.getByRole("textbox", { name: "Commentaire de refus" }), "Doublon");
    await user.click(screen.getByRole("button", { name: "Refuser" }));

    await waitFor(() =>
      expect(apiMocks.rejectChangeRequest).toHaveBeenCalledWith("request-1", "Doublon")
    );
    expect(await screen.findByText("Demande refusée.")).toBeInTheDocument();
  });

  it("applies a direct edit and reports API failures", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn(async () => undefined);
    const onError = vi.fn();
    renderView({ onDataChanged, onError });

    await screen.findAllByText("Camille Morel");
    await user.click(screen.getByRole("button", { name: "Appliquer directement" }));
    await waitFor(() =>
      expect(apiMocks.editCharacterDirectly).toHaveBeenCalledWith("character-1", snapshot)
    );
    expect(onDataChanged).toHaveBeenCalledOnce();
    expect(await screen.findByText("Fiche modifiée directement.")).toBeInTheDocument();

    apiMocks.approveChangeRequest.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Accepter" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Impossible d'accepter la demande."));
  });
});
