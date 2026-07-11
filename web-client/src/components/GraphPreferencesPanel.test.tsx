import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { initialGraphPreferences } from "../graph/graphPreferences";
import { GraphPreferencesPanel } from "./GraphPreferencesPanel";

describe("GraphPreferencesPanel", () => {
  it("opens the collapsed panel", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <GraphPreferencesPanel
        isOpen={false}
        preferences={initialGraphPreferences}
        onOpen={onOpen}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Affichage du graphe" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("updates display, layout and relationship preferences", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GraphPreferencesPanel
        isOpen
        preferences={initialGraphPreferences}
        onOpen={vi.fn()}
        onClose={onClose}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("checkbox", { name: "Afficher les personnages décédés" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialGraphPreferences,
      showDeceased: true
    });

    await user.click(screen.getByRole("button", { name: "Familles" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialGraphPreferences,
      layoutMode: "family"
    });

    await user.click(screen.getByRole("button", { name: "Ancien personnage" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialGraphPreferences,
      visibleRelationshipTypes: [
        ...initialGraphPreferences.visibleRelationshipTypes,
        "previous_character"
      ]
    });

    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(onChange).toHaveBeenLastCalledWith(initialGraphPreferences);

    await user.click(screen.getByRole("button", { name: "X" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the default relationships when the last visible type is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <GraphPreferencesPanel
        isOpen
        preferences={{
          ...initialGraphPreferences,
          visibleRelationshipTypes: ["parent"]
        }}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Parent" }));
    expect(onChange).toHaveBeenCalledWith(initialGraphPreferences);
  });
});
