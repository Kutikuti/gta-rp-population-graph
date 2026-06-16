import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the application shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "GTA-RP Population Graph" })).toBeInTheDocument();
    expect(screen.getByLabelText("Graphe des personnages")).toBeInTheDocument();
    expect(screen.getByLabelText("Fiche personnage")).toBeInTheDocument();
  });
});
