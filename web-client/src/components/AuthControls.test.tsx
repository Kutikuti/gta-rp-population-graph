import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AuthControls } from "./AuthControls";

it("moves focus into the login menu and restores it when closed", async () => {
  const user = userEvent.setup();
  render(
    <AuthControls
      activeView="explore"
      isLoading={false}
      session={null}
      loginOptions={[{ provider: "google", label: "Google", href: "/api/auth/google" }]}
      onLogout={vi.fn()}
      onProfile={vi.fn()}
    />
  );

  const loginButton = screen.getByRole("button", { name: "Connexion" });
  await user.click(loginButton);

  expect(screen.getByRole("button", { name: "Fermer la connexion" })).toHaveFocus();

  await user.keyboard("{Escape}");

  expect(loginButton).toHaveFocus();
  expect(screen.queryByRole("dialog", { name: "Choisir une connexion" })).not.toBeInTheDocument();
});
