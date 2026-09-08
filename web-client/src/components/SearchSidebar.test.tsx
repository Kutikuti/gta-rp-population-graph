import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { initialFilters } from "../constants";
import { SearchSidebar } from "./SearchSidebar";

it("moves focus into the search panel and restores it when closed", async () => {
  function Example() {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <SearchSidebar
        canSuggestCreation={false}
        creationActionLabel="Proposer une fiche"
        companies={[]}
        filters={initialFilters}
        isOpen={isOpen}
        resultSummary={null}
        tags={[]}
        onChange={vi.fn()}
        onClose={() => setIsOpen(false)}
        onOpen={() => setIsOpen(true)}
        onReset={vi.fn()}
        onSuggestCreation={vi.fn()}
      />
    );
  }

  const user = userEvent.setup();
  render(<Example />);

  await user.click(screen.getByRole("button", { name: "Ouvrir la recherche" }));
  expect(screen.getByRole("button", { name: "Replier la recherche" })).toHaveFocus();

  await user.click(screen.getByRole("button", { name: "Replier la recherche" }));
  expect(screen.getByRole("button", { name: "Ouvrir la recherche" })).toHaveFocus();
});
