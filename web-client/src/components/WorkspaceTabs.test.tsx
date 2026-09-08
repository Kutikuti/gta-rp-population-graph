import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { WorkspaceTabs } from "./WorkspaceTabs";

it("supports arrow keys, Home and End with a single active panel", async () => {
  function Example() {
    const [activeTab, setActiveTab] = useState("users");
    return (
      <WorkspaceTabs
        label="Administration"
        tabs={[
          { id: "users", label: "Utilisateurs" },
          { id: "tags", label: "Tags" },
          { id: "logs", label: "Journaux" }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      >
        {activeTab}
      </WorkspaceTabs>
    );
  }
  const user = userEvent.setup();
  render(<Example />);
  await user.tab();
  expect(screen.getByRole("tab", { name: "Utilisateurs" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Tags" })).toHaveFocus();
  expect(screen.getByRole("tabpanel", { name: "Tags" })).toHaveTextContent("tags");
  await user.keyboard("{End}{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Utilisateurs" })).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: "Journaux" })).toHaveFocus();
  await user.keyboard("{Home}{Tab}");
  expect(screen.getByRole("tabpanel", { name: "Utilisateurs" })).toHaveFocus();
});
