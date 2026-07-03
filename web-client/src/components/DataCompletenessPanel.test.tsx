import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DataCompletenessReport } from "../api";
import { DataCompletenessPanel } from "./DataCompletenessPanel";

const report: DataCompletenessReport = {
  summary: {
    total: 3,
    withMissingFields: 2,
    importedOrCommunity: 2,
    needsReview: 1
  },
  items: [
    {
      id: "char-1",
      publicSlug: "camille-morel",
      fullName: "Camille Morel",
      verificationStatus: "to_check",
      dataSource: "notion",
      missingFields: [
        { key: "photoUrl", label: "Photo" },
        { key: "phoneNumbers", label: "Téléphone" }
      ],
      attentionFlags: ["À vérifier", "Importée"],
      updatedAt: "2026-07-02T12:00:00.000Z"
    },
    {
      id: "char-2",
      publicSlug: "ines-morel",
      fullName: "Ines Morel",
      verificationStatus: "community",
      dataSource: "seed",
      missingFields: [],
      attentionFlags: ["Communautaire"],
      updatedAt: "2026-07-02T13:00:00.000Z"
    }
  ]
};

describe("DataCompletenessPanel", () => {
  it("renders the completeness summary and item details", () => {
    render(<DataCompletenessPanel isLoading={false} report={report} />);

    expect(screen.getByRole("heading", { name: "Fiches à compléter" })).toBeInTheDocument();
    expect(screen.getByText("2 incomplètes")).toBeInTheDocument();
    expect(screen.getByText("2 importées/communautaires")).toBeInTheDocument();
    expect(screen.getByText("1 à revoir")).toBeInTheDocument();
    expect(screen.getByText("Camille Morel")).toBeInTheDocument();
    expect(screen.getByText("Photo")).toBeInTheDocument();
    expect(screen.getByText("Téléphone")).toBeInTheDocument();
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
    expect(screen.getByText("Importée")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ouvrir" })[0]).toHaveAttribute(
      "href",
      "/?character=camille-morel"
    );
  });

  it("shows the loading state and the empty state", () => {
    const { rerender } = render(<DataCompletenessPanel isLoading report={null} />);

    expect(screen.getByText("Chargement de la complétude...")).toBeInTheDocument();

    rerender(
      <DataCompletenessPanel
        isLoading={false}
        report={{
          summary: {
            total: 0,
            withMissingFields: 0,
            importedOrCommunity: 0,
            needsReview: 0
          },
          items: []
        }}
      />
    );

    expect(
      screen.getByText("Aucune fiche ne remonte actuellement dans cette vue.")
    ).toBeInTheDocument();
  });

  it("filters items by search and quick filters", async () => {
    const user = userEvent.setup();

    render(<DataCompletenessPanel isLoading={false} report={report} />);

    await user.type(
      screen.getByPlaceholderText("Rechercher une fiche ou un champ..."),
      "téléphone"
    );

    expect(screen.getByText("Camille Morel")).toBeInTheDocument();
    expect(screen.queryByText("Ines Morel")).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Rechercher une fiche ou un champ..."));
    await user.click(screen.getByRole("button", { name: "À revoir" }));

    expect(screen.getByText("Camille Morel")).toBeInTheDocument();
    expect(screen.queryByText("Ines Morel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "À revoir" }));
    await user.click(screen.getByRole("button", { name: "Champs manquants" }));

    expect(screen.getByText("Camille Morel")).toBeInTheDocument();
    expect(screen.queryByText("Ines Morel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Champs manquants" }));
    await user.type(screen.getByPlaceholderText("Rechercher une fiche ou un champ..."), "absent");

    expect(screen.getByText("Aucune fiche ne correspond aux filtres actuels.")).toBeInTheDocument();
  });

  it("calls the edit callback from a completeness entry", async () => {
    const user = userEvent.setup();
    const onEditCharacter = vi.fn();

    render(
      <DataCompletenessPanel isLoading={false} onEditCharacter={onEditCharacter} report={report} />
    );

    await user.click(screen.getAllByRole("button", { name: "Modifier" })[0]);

    expect(onEditCharacter).toHaveBeenCalledWith("camille-morel");
  });
});
