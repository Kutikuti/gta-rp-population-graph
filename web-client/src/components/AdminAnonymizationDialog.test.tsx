import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { AdminUser } from "../api";
import { AdminAnonymizationDialog } from "./AdminAnonymizationDialog";

const user: AdminUser = {
  id: "user-1",
  email: "user@example.test",
  displayName: "Camille Morel",
  role: { id: "role-1", name: "user" },
  isBanned: false,
  createdAt: "2026-09-08T00:00:00.000Z",
  lastLoginAt: null
};

it("focuses the confirmation field and closes with Escape", async () => {
  const onCancel = vi.fn();
  const userEventInstance = userEvent.setup();
  render(<AdminAnonymizationDialog user={user} onCancel={onCancel} onConfirm={vi.fn()} />);

  const confirmationInput = screen.getByRole("textbox");
  expect(confirmationInput).toHaveFocus();

  await userEventInstance.keyboard("{Escape}");

  expect(onCancel).toHaveBeenCalledOnce();
});
