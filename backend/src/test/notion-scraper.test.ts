import { describe, expect, it } from "vitest";

import { extractNotionPageId, scrapePublicNotionPage } from "../services/notion-scraper.js";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

describe("notion scraper", () => {
  it("extracts a dashed Notion page id from a public URL", () => {
    expect(
      extractNotionPageId(
        "https://www.notion.so/Flashback-Whitelist-V6-34407fc32f6c80968f3bdedadec5253c"
      )
    ).toBe("34407fc3-2f6c-8096-8f3b-dedadec5253c");
  });

  it("loads child pages and converts text properties to import input", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const characterId = "11111111-2222-4333-8444-555555555555";
    const calls: string[] = [];
    const fetchMock = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.pageId);

      if (body.pageId === rootId) {
        return jsonResponse({
          recordMap: {
            block: {
              [rootId]: {
                value: {
                  id: rootId,
                  type: "page",
                  properties: { title: [["Flashback Whitelist V6"]] },
                  content: [characterId]
                }
              },
              [characterId]: {
                value: {
                  id: characterId,
                  type: "page",
                  properties: { title: [["Ada Lovelace"]] }
                }
              }
            }
          }
        });
      }

      return jsonResponse({
        recordMap: {
          block: {
            [characterId]: {
              value: {
                id: characterId,
                type: "page",
                properties: { title: [["Ada Lovelace"]] },
                content: ["text-1", "text-2"]
              }
            },
            "text-1": {
              value: {
                id: "text-1",
                type: "text",
                properties: { title: [["Streamer: AdaLive\nTags: Famille, Tech"]] }
              }
            },
            "text-2": {
              value: {
                id: "text-2",
                type: "bulleted_list",
                properties: { title: [["Relations: couple: Grace Hopper"]] }
              }
            }
          }
        }
      });
    };

    const input = await scrapePublicNotionPage(
      "https://www.notion.so/Flashback-Whitelist-V6-34407fc32f6c80968f3bdedadec5253c",
      { fetch: fetchMock }
    );

    expect(calls).toEqual([rootId, characterId]);
    expect(input).toMatchObject({
      sourceName: "Flashback Whitelist V6",
      fullSource: true,
      pages: [
        {
          pageId: characterId,
          properties: {
            Prenom: "Ada",
            Nom: "Lovelace",
            Streamer: "AdaLive",
            Tags: ["Famille", "Tech"],
            Relations: "couple: Grace Hopper",
            "Titre Notion": "Ada Lovelace"
          }
        }
      ]
    });
  });

  it("loads collection view rows from page_sort and maps schema property names", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const collectionId = "5bf2e238-dead-4ad6-8a19-10f4c9bfdce2";
    const viewId = "34d07fc3-2f6c-80b5-aefe-000c0049dbff";
    const characterId = "35107fc3-2f6c-80c3-9da0-c5ce0cd351d3";
    const calls: string[] = [];
    const fetchMock = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.pageId);

      if (body.pageId === rootId) {
        return jsonResponse({
          recordMap: {
            block: {
              [rootId]: {
                value: {
                  value: {
                    id: rootId,
                    type: "page",
                    properties: { title: [["Flashback Whitelist V6"]] }
                  }
                }
              },
              "collection-block": {
                value: {
                  value: {
                    id: "collection-block",
                    type: "collection_view",
                    collection_id: collectionId,
                    view_ids: [viewId]
                  }
                }
              }
            },
            collection_view: {
              [viewId]: {
                value: {
                  value: {
                    id: viewId,
                    type: "gallery",
                    name: "Tous",
                    page_sort: [characterId],
                    format: {
                      collection_pointer: { id: collectionId }
                    }
                  }
                }
              }
            },
            collection: {
              [collectionId]: {
                value: {
                  value: {
                    id: collectionId,
                    schema: {
                      title: { name: "Nom", type: "title" },
                      nq_z: { name: "Twitch", type: "text" },
                      uJKq: { name: "Métier/entreprise", type: "multi_select" }
                    }
                  }
                }
              }
            }
          }
        });
      }

      return jsonResponse({
        recordMap: {
          block: {
            [characterId]: {
              value: {
                value: {
                  id: characterId,
                  type: "page",
                  properties: {
                    title: [["Lavina Navaro"]],
                    nq_z: [["emstazy"]],
                    uJKq: [["Aucun métier/entreprise"]]
                  }
                }
              }
            }
          },
          collection: {}
        }
      });
    };

    const input = await scrapePublicNotionPage(
      "https://www.notion.so/Flashback-Whitelist-V6-34407fc32f6c80968f3bdedadec5253c",
      { fetch: fetchMock }
    );

    expect(calls).toEqual([rootId, characterId]);
    expect(input.pages).toEqual([
      {
        pageId: characterId,
        url: "https://www.notion.so/35107fc32f6c80c39da0c5ce0cd351d3",
        properties: {
          Prenom: "Lavina",
          Nom: "Navaro",
          "Titre Notion": "Lavina Navaro",
          Twitch: "emstazy",
          "Métier/entreprise": "Aucun métier/entreprise"
        }
      }
    ]);
  });
});
