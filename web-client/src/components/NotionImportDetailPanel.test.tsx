import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AdminNotionImportEntry } from "../api";
import { NotionImportDetailPanel } from "./NotionImportDetailPanel";

const baseEntry: AdminNotionImportEntry = {
  status: "new",
  pageId: "page-1",
  fullName: "Ada Lovelace",
  lifeStatus: "alive",
  streamer: "AdaLive",
  socialLinks: { twitch: "https://twitch.tv/adalive", discord: "https://discord.gg/adalive" },
  company: null,
  group: null,
  tags: "",
  photoReferences: [],
  sourceUrl: "https://example.test/ada",
  rawContent: {},
  mappedSnapshot: {},
  mappingReport: {},
  appliedCharacterId: null,
  appliedAt: null,
  createdAt: "2026-07-06T00:00:00.000Z"
};

describe("NotionImportDetailPanel", () => {
  it("explains that imported links are carried by the linked streamer", () => {
    render(
      <NotionImportDetailPanel
        feedback={null}
        isApplying={false}
        isImportingPhoto={false}
        selectedEntry={baseEntry}
        onApplyEntry={() => {}}
        onImportPhoto={() => {}}
      />
    );

    expect(
      screen.getByText(/les liens publics seront portés par le streamer rattaché/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/ses liens pourront être enrichis ou mis à jour/i)).toBeInTheDocument();
  });

  it("explains that no public link is kept without a linked streamer", () => {
    render(
      <NotionImportDetailPanel
        feedback={null}
        isApplying={false}
        isImportingPhoto={false}
        selectedEntry={{ ...baseEntry, streamer: null, socialLinks: null }}
        onApplyEntry={() => {}}
        onImportPhoto={() => {}}
      />
    );

    expect(
      screen.getByText(
        /aucun lien public ne sera conservé sur la fiche tant qu'aucun streamer n'est rattaché/i
      )
    ).toBeInTheDocument();
  });
});
