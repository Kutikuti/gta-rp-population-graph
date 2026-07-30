import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CharacterSnapshot, PublicCharacterReference, PublicStreamer } from "../api";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";

const baseSnapshot: CharacterSnapshot = {
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
  verificationStatus: "to_check",
  sourceNote: null
};

const streamers: PublicStreamer[] = [
  {
    id: "streamer-1",
    publicName: "NovaRP",
    primaryPlatform: "twitch",
    socialLinks: {
      twitch: "https://twitch.tv/novarp",
      discord: "https://discord.gg/novarp"
    },
    twitchLiveStatus: "offline",
    verificationStatus: "community"
  }
];

function FormHarness({
  initialSnapshot = baseSnapshot,
  characterOptions = [],
  currentCharacterId = null,
  canUploadPhoto = false,
  submitLabel = "Modifier",
  isSubmitting = false,
  onCancel = () => {},
  onSubmit = () => {},
  onPhotoUpload = vi.fn(async () => {})
}: {
  initialSnapshot?: CharacterSnapshot;
  characterOptions?: PublicCharacterReference[];
  currentCharacterId?: string | null;
  canUploadPhoto?: boolean;
  submitLabel?: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onSubmit?: () => void;
  onPhotoUpload?: (image: Blob) => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  return (
    <CharacterSnapshotForm
      snapshot={snapshot}
      characterOptions={characterOptions}
      currentCharacterId={currentCharacterId}
      streamers={streamers}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      canUploadPhoto={canUploadPhoto}
      isPhotoUploading={false}
      onCancel={onCancel}
      onChange={setSnapshot}
      onPhotoRemove={() => {
        setSnapshot((current) => ({ ...current, photoUrl: null }));
      }}
      onPhotoUpload={onPhotoUpload}
      onSubmit={onSubmit}
    />
  );
}

describe("CharacterSnapshotForm", () => {
  it("edits identity, status, organization and source fields", async () => {
    const user = userEvent.setup();

    render(<FormHarness />);

    await user.clear(screen.getByLabelText("Prénom"));
    await user.type(screen.getByLabelText("Prénom"), "Julien");
    await user.type(screen.getByLabelText("Surnom"), "Jules");
    await user.type(screen.getByLabelText("Date de naissance"), "1990-04-12");
    await user.selectOptions(screen.getByLabelText("Statut vital"), "deceased");
    await user.type(screen.getByLabelText("Date décès ou départ"), "2026-01-05");
    await user.type(screen.getByLabelText("Entreprise"), "BCSO");
    await user.type(screen.getByLabelText("Grade"), "Deputy");
    await user.type(screen.getByLabelText("Matricule"), "42");
    await user.type(screen.getByLabelText("Groupe"), "Nord");
    await user.type(screen.getByLabelText("Quartier"), "Paleto");
    await user.selectOptions(screen.getByLabelText("Vérification"), "verified");
    await user.type(screen.getByLabelText("Note de source"), "Information verifiee.");

    expect(screen.getByLabelText("Prénom")).toHaveValue("Julien");
    expect(screen.getByLabelText("Surnom")).toHaveValue("Jules");
    expect(screen.getByLabelText("Date de naissance")).toHaveValue("1990-04-12");
    expect(screen.getByLabelText("Statut vital")).toHaveValue("deceased");
    expect(screen.getByLabelText("Date décès ou départ")).toHaveValue("2026-01-05");
    expect(screen.getByLabelText("Entreprise")).toHaveValue("BCSO");
    expect(screen.getByLabelText("Grade")).toHaveValue("Deputy");
    expect(screen.getByLabelText("Matricule")).toHaveValue("42");
    expect(screen.getByLabelText("Groupe")).toHaveValue("Nord");
    expect(screen.getByLabelText("Quartier")).toHaveValue("Paleto");
    expect(screen.getByLabelText("Vérification")).toHaveValue("verified");
    expect(screen.getByLabelText("Note de source")).toHaveValue("Information verifiee.");
  });

  it("renders photo upload when allowed and wires form actions", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <FormHarness
        canUploadPhoto
        initialSnapshot={{ ...baseSnapshot, photoUrl: "/uploads/camille.webp" }}
        onCancel={onCancel}
        onSubmit={onSubmit}
        submitLabel="Appliquer la modification"
      />
    );

    expect(screen.getByText("Importer une photo")).toBeInTheDocument();
    expect(screen.getByText("Choisir un fichier")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    await user.click(screen.getByRole("button", { name: "Appliquer la modification" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the submitting state on the submit button", () => {
    render(<FormHarness isSubmitting />);

    expect(screen.getByRole("button", { name: "Envoi..." })).toBeDisabled();
  });

  it("loads the selected streamer's links into the media fields", async () => {
    const user = userEvent.setup();

    render(<FormHarness />);

    const streamerSelect = screen.getByLabelText("Streamer existant");
    const twitchInput = screen.getByLabelText("Twitch");
    const discordInput = screen.getByLabelText("Discord");

    expect(twitchInput).toBeDisabled();
    expect(discordInput).toBeDisabled();

    await user.selectOptions(streamerSelect, "streamer-1");

    expect(twitchInput).toHaveValue("https://twitch.tv/novarp");
    expect(discordInput).toHaveValue("https://discord.gg/novarp");
    expect(twitchInput).not.toBeDisabled();
    expect(discordInput).not.toBeDisabled();
  });

  it("clears media links when the streamer is removed", async () => {
    const user = userEvent.setup();

    render(
      <FormHarness
        initialSnapshot={{
          ...baseSnapshot,
          streamerId: "streamer-1",
          socialLinks: streamers[0].socialLinks
        }}
      />
    );

    const streamerSelect = screen.getByLabelText("Streamer existant");
    const twitchInput = screen.getByLabelText("Twitch");
    const discordInput = screen.getByLabelText("Discord");

    expect(twitchInput).toHaveValue("https://twitch.tv/novarp");
    expect(discordInput).toHaveValue("https://discord.gg/novarp");

    await user.selectOptions(streamerSelect, "");

    expect(twitchInput).toHaveValue("");
    expect(discordInput).toHaveValue("");
    expect(twitchInput).toBeDisabled();
    expect(discordInput).toBeDisabled();
  });

  it("adds, edits and removes phone numbers", async () => {
    const user = userEvent.setup();
    render(<FormHarness />);

    await user.click(screen.getByRole("button", { name: "Ajouter un numéro de téléphone" }));
    const phoneInput = screen.getByPlaceholderText("Numéro de téléphone");
    await user.type(phoneInput, "555-0199");
    expect(phoneInput).toHaveValue("555-0199");

    await user.click(screen.getByRole("button", { name: "Retirer ce numéro de téléphone" }));
    expect(screen.queryByPlaceholderText("Numéro de téléphone")).not.toBeInTheDocument();
  });

  it("adds, edits and removes relations while excluding the current character", async () => {
    const user = userEvent.setup();
    const characters: PublicCharacterReference[] = [
      { id: "current", publicSlug: "camille-morel", fullName: "Camille Morel" },
      { id: "target-1", publicSlug: "ines-morel", fullName: "Inès Morel" },
      { id: "target-2", publicSlug: "victor-morel", fullName: "Victor Morel" }
    ];
    render(<FormHarness characterOptions={characters} currentCharacterId="current" />);

    await user.click(screen.getByRole("button", { name: "Ajouter une relation" }));
    const characterSelect = screen.getByLabelText("Personnage");
    const relationSelect = screen.getByLabelText("Lien");
    expect(characterSelect).toHaveValue("target-1");
    expect(screen.queryByRole("option", { name: "Camille Morel" })).not.toBeInTheDocument();

    await user.selectOptions(characterSelect, "target-2");
    await user.selectOptions(relationSelect, "sibling");
    expect(characterSelect).toHaveValue("target-2");
    expect(relationSelect).toHaveValue("sibling");

    await user.click(screen.getByRole("button", { name: "Retirer cette relation" }));
    expect(screen.queryByLabelText("Personnage")).not.toBeInTheDocument();
  });

  it("starts and cancels a new streamer draft after clearing existing media", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        initialSnapshot={{
          ...baseSnapshot,
          streamerId: "streamer-1",
          socialLinks: streamers[0].socialLinks
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Ajouter un streamer" }));
    expect(screen.getByLabelText("Streamer existant")).toHaveValue("");
    expect(screen.getByLabelText("Twitch")).toHaveValue("");
    expect(screen.getByLabelText("Discord")).toHaveValue("");

    const streamerName = screen.getByLabelText("Nouveau streamer");
    await user.type(streamerName, "Nouvelle chaîne");
    await user.type(screen.getByLabelText("Twitch"), "https://twitch.tv/nouvelle-chaine");
    expect(streamerName).toHaveValue("Nouvelle chaîne");
    expect(screen.getByLabelText("Twitch")).toHaveValue("https://twitch.tv/nouvelle-chaine");

    const createRow = streamerName.closest(".media-streamer-create-row");
    expect(createRow).not.toBeNull();
    await user.click(within(createRow as HTMLElement).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByLabelText("Nouveau streamer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Twitch")).toBeDisabled();
  });
});
