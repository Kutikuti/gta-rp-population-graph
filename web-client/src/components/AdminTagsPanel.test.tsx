import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminTag, AdminTagInput } from "../api";
import { AdminTagsPanel } from "./AdminTagsPanel";

const tagInput: AdminTagInput = {
  name: "",
  type: null,
  colorHex: "#2288cc",
  description: null
};

const tags: AdminTag[] = [
  {
    id: "tag-used",
    name: "Famille Morel",
    type: "family",
    colorHex: "#336699",
    description: null,
    usageCount: 2
  },
  {
    id: "tag-unused",
    name: "À classer",
    type: null,
    colorHex: "#999999",
    description: "Tag temporaire",
    usageCount: 0
  }
];

const renderPanel = (overrides: Partial<React.ComponentProps<typeof AdminTagsPanel>> = {}) => {
  const props: React.ComponentProps<typeof AdminTagsPanel> = {
    editingTag: null,
    tagInput,
    tags,
    onCancelEdit: vi.fn(),
    onDeleteTag: vi.fn(),
    onEditTag: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    onTagInputChange: vi.fn(),
    ...overrides
  };

  return { ...render(<AdminTagsPanel {...props} />), props };
};

describe("AdminTagsPanel", () => {
  it("propagates every tag field and accepts an empty description", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Nouveau tag" } });
    expect(props.onTagInputChange).toHaveBeenLastCalledWith({ ...tagInput, name: "Nouveau tag" });

    await user.selectOptions(screen.getByLabelText("Type"), "business");
    expect(props.onTagInputChange).toHaveBeenLastCalledWith({ ...tagInput, type: "business" });

    fireEvent.change(screen.getByLabelText("Couleur"), { target: { value: "#abcdef" } });
    expect(props.onTagInputChange).toHaveBeenLastCalledWith({ ...tagInput, colorHex: "#abcdef" });

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Description facultative" }
    });
    expect(props.onTagInputChange).toHaveBeenLastCalledWith({
      ...tagInput,
      description: "Description facultative"
    });

    await user.click(screen.getByRole("button", { name: "Créer le tag" }));
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it("renders tag metadata and protects tags still in use", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    const usedTagRow = screen.getByText("Famille Morel").closest("article");
    expect(usedTagRow).not.toBeNull();
    expect(within(usedTagRow as HTMLElement).getByText("Famille")).toBeInTheDocument();
    expect(screen.getByText("Sans type")).toBeInTheDocument();
    expect(screen.getByText("2 fiche(s)")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).toBeEnabled();
    await user.click(deleteButtons[1]);
    expect(props.onDeleteTag).toHaveBeenCalledWith(tags[1]);

    const editButtons = screen.getAllByRole("button", { name: "Modifier" });
    await user.click(editButtons[0]);
    expect(props.onEditTag).toHaveBeenCalledWith(tags[0]);
  });

  it("shows editing actions and cancels the current edit", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      editingTag: tags[0],
      tagInput: { ...tagInput, name: tags[0].name }
    });

    expect(screen.getByRole("button", { name: "Modifier le tag" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(props.onCancelEdit).toHaveBeenCalledOnce();
  });
});
