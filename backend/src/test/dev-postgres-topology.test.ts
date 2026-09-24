import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../", import.meta.url);

describe("development PostgreSQL network contract", () => {
  it("keeps PostgreSQL off published host ports and shares only the private dev network", () => {
    const compose = readFileSync(new URL("docker-compose.yml", repositoryRoot), "utf8");
    const backendEnvExample = readFileSync(
      new URL("backend/.env.example", repositoryRoot),
      "utf8"
    );
    const devcontainer = JSON.parse(
      readFileSync(new URL(".devcontainer/devcontainer.json", repositoryRoot), "utf8")
    ) as { runArgs: string[] };

    expect(compose).not.toMatch(/^\s+ports:/mu);
    expect(compose).toContain("external: true");
    expect(compose).toContain("name: gta-rp-dev");
    expect(compose).toContain("POSTGRES_PASSWORD: ${DB_PASSWORD:?");
    expect(compose).not.toContain("POSTGRES_PASSWORD: postgres");
    expect(backendEnvExample).toMatch(/^DB_HOST=postgres$/mu);
    expect(devcontainer.runArgs).toContain("--network=gta-rp-dev");
  });
});
