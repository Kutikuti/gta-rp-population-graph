import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AuthenticatedUser,
  ChangeRequestSummary,
  CharacterSnapshot,
  PersonalDataExport,
  PublicCharacterReference
} from "../api";
import { ProfileIdentitySection } from "./ProfileIdentitySection";
import { ProfileLinkedAccountsSection } from "./ProfileLinkedAccountsSection";
import { ProfileRequestsSection } from "./ProfileRequestsSection";

const snapshot: CharacterSnapshot = {
  firstName: "Camille",
  lastName: "Morel",
  nickname: null,
  birthDate: null,
  lifeStatus: "alive",
  deathOrDepartureDate: null,
  photoUrl: null,
  companyName: "BCSO",
  companyRank: null,
  companyBadgeNumber: null,
  phoneNumbers: ["555-0101"],
  streamerId: null,
  streamerName: null,
  socialLinks: null,
  groupName: null,
  district: null,
  isRpDeath: false,
  relationships: [{ characterId: "character-2", type: "sibling" }],
  previousCharacters: null,
  verificationStatus: "to_check",
  sourceNote: null
};

const identities: AuthenticatedUser["linkedIdentities"] = [
  {
    id: "identity-google",
    provider: "google",
    connectedAt: "2026-06-01T10:00:00.000Z",
    lastUsedAt: "2026-06-10T10:00:00.000Z",
    canUnlink: true
  }
];

const personalDataExport: PersonalDataExport = {
  exportedAt: "2026-06-17T12:00:00.000Z",
  account: {
    id: "user-1",
    email: "viewer@example.test",
    displayName: "Viewer",
    displayNameChosenAt: "2026-06-01T10:00:00.000Z",
    avatarUrl: null,
    role: "user",
    isBanned: false,
    lastLoginAt: "2026-06-17T11:00:00.000Z",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-17T11:00:00.000Z"
  },
  linkedIdentities: [
    {
      id: "identity-google",
      provider: "google",
      providerEmail: "viewer@example.test",
      providerDisplayName: "Viewer",
      providerAvatarUrl: null,
      connectedAt: "2026-06-01T10:00:00.000Z",
      lastUsedAt: "2026-06-17T11:00:00.000Z"
    }
  ]
};

const request: ChangeRequestSummary = {
  id: "request-1",
  requestType: "update",
  characterId: "character-1",
  characterName: "Camille Morel",
  proposedStreamerName: null,
  userId: "user-1",
  userDisplayName: "Viewer",
  status: "pending",
  proposedSnapshot: snapshot,
  searchContext: null,
  reviewerId: null,
  reviewerDisplayName: null,
  moderatorComment: null,
  resolvedAt: null,
  createdAt: "2026-06-17T12:00:00.000Z",
  updatedAt: "2026-06-17T12:00:00.000Z"
};

const characterOptions: PublicCharacterReference[] = [
  { id: "character-1", publicSlug: "camille-morel", fullName: "Camille Morel" },
  { id: "character-2", publicSlug: "ines-morel", fullName: "Ines Morel" }
];

describe("profile sections", () => {
  it("edits the public display name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    const onDisplayNameChange = vi.fn();

    render(
      <ProfileIdentitySection
        displayName="Viewer"
        email="viewer@example.test"
        isSaving={false}
        mustChooseDisplayName
        onDisplayNameChange={onDisplayNameChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Choisis un nom public avant de contribuer.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nom d'affichage public"), " RP");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onDisplayNameChange).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders linked account actions and personal data export", async () => {
    const user = userEvent.setup();
    const onExportPersonalData = vi.fn();
    const onIdentityUnlink = vi.fn();

    render(
      <ProfileLinkedAccountsSection
        identities={identities}
        isExporting={false}
        personalDataExport={personalDataExport}
        unlinkingProvider={null}
        onExportPersonalData={onExportPersonalData}
        onIdentityUnlink={onIdentityUnlink}
      />
    );

    await user.click(screen.getByRole("button", { name: "Dissocier Google" }));
    await user.click(screen.getByRole("button", { name: "Exporter mes données" }));

    expect(screen.getByRole("link", { name: "Lier Discord" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lier Twitch" })).toBeInTheDocument();
    expect(screen.getByText("Export personnel")).toBeInTheDocument();
    expect(screen.getAllByText("viewer@example.test")).toHaveLength(2);
    expect(onIdentityUnlink).toHaveBeenCalledWith("google");
    expect(onExportPersonalData).toHaveBeenCalledTimes(1);
  });

  it("toggles contribution request details", async () => {
    const user = userEvent.setup();
    const onExpandedRequestChange = vi.fn();

    const { rerender } = render(
      <ProfileRequestsSection
        characterOptions={characterOptions}
        expandedRequestId={null}
        isLoading={false}
        requests={[request]}
        onExpandedRequestChange={onExpandedRequestChange}
      />
    );

    expect(
      screen.getByRole("button", { name: /Modification - Camille Morel/ })
    ).toBeInTheDocument();
    expect(screen.queryByText("Téléphones")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Modification - Camille Morel/ }));
    expect(onExpandedRequestChange).toHaveBeenCalledWith("request-1");

    rerender(
      <ProfileRequestsSection
        characterOptions={characterOptions}
        expandedRequestId="request-1"
        isLoading={false}
        requests={[request]}
        onExpandedRequestChange={onExpandedRequestChange}
      />
    );

    expect(screen.getByText("Téléphones")).toBeInTheDocument();
    expect(screen.getByText("• Fratrie : Ines Morel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Modification - Camille Morel/ }));
    expect(onExpandedRequestChange).toHaveBeenLastCalledWith(null);
  });
});
