import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChangeRequestSummary } from "../api";
import { ModerationRequestList } from "./ModerationRequestList";

const request = (overrides: Partial<ChangeRequestSummary> = {}): ChangeRequestSummary =>
  ({
    id: "request-1",
    requestType: "update",
    characterName: "Camille Morel",
    userDisplayName: "Julien",
    createdAt: "2026-07-12T08:00:00.000Z",
    ...overrides
  }) as ChangeRequestSummary;

describe("ModerationRequestList", () => {
  it("shows loading and empty states in their respective contexts", () => {
    const { rerender } = render(
      <ModerationRequestList
        isLoading
        requests={[]}
        selectedRequestId={null}
        onSelectRequest={vi.fn()}
      />
    );

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.queryByText("Aucune demande en attente.")).not.toBeInTheDocument();

    rerender(
      <ModerationRequestList
        isLoading={false}
        requests={[]}
        selectedRequestId={null}
        onSelectRequest={vi.fn()}
      />
    );

    expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    expect(screen.getByText("Aucune demande en attente.")).toBeInTheDocument();
  });

  it("renders request details, fallbacks and selection", () => {
    const onSelectRequest = vi.fn();
    render(
      <ModerationRequestList
        isLoading={false}
        requests={[
          request(),
          request({
            id: "request-2",
            requestType: "create",
            characterName: null,
            userDisplayName: null
          })
        ]}
        selectedRequestId="request-2"
        onSelectRequest={onSelectRequest}
      />
    );

    expect(screen.getByText("Camille Morel")).toBeInTheDocument();
    expect(screen.getByText("Julien")).toBeInTheDocument();
    expect(screen.getByTitle("Demande de création")).toHaveTextContent("Création");
    expect(screen.getByText("Personnage supprimé")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur inconnu")).toBeInTheDocument();

    const creationButton = screen.getByText("Personnage supprimé").closest("button");
    expect(creationButton).toHaveClass("is-active");
    fireEvent.click(creationButton as HTMLButtonElement);
    expect(onSelectRequest).toHaveBeenCalledWith("request-2");
  });
});
