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
                content: ["text-1", "text-2"],
                format: {
                  page_icon: "https://secure.notion-static.com/ada-avatar.webp"
                }
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
            Photo: ["https://secure.notion-static.com/ada-avatar.webp"],
            "Titre Notion": "Ada Lovelace"
          }
        }
      ]
    });
  });

  it("merges duplicated text properties instead of overwriting earlier values", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const characterId = "11111111-2222-4333-8444-555555555555";
    const fetchMock = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

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
                properties: { title: [["Tags: Famille\nRelations: couple: Grace Hopper"]] }
              }
            },
            "text-2": {
              value: {
                id: "text-2",
                type: "text",
                properties: { title: [["Tags: Tech\nRelations: sibling: Byron Lovelace"]] }
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

    expect(input.pages[0]?.properties).toMatchObject({
      Tags: ["Famille", "Tech"],
      Relations: ["couple: Grace Hopper", "sibling: Byron Lovelace"]
    });
  });

  it("prefers image blocks inside the page content and builds attachment URLs from the image block id", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const characterId = "34b07fc3-2f6c-80fa-a3e7-d0067ef268bc";
    const imageBlockId = "36607fc3-2f6c-8050-aa68-cb48f49179a8";
    const fetchMock = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

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
                  properties: { title: [["Abel Simango"]] }
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
                properties: { title: [["Abel Simango"]] },
                content: [imageBlockId],
                format: {
                  social_media_image_preview_url:
                    "attachment:65577dd0-c9bb-4bbc-9516-796f781b7cc3:SocialMediaPreviewImage.png"
                }
              }
            },
            [imageBlockId]: {
              value: {
                id: imageBlockId,
                type: "image",
                space_id: "174a582a-d105-4b37-963c-91844b8ef4a1",
                format: {
                  display_source: "attachment:7b1897ff-04ba-4e49-94ca-9634b6595086:Abel_Simango.jpg"
                },
                properties: { title: [["Abel Simango.JPG"]] }
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

    expect(input.pages).toEqual([
      {
        pageId: characterId,
        url: "https://www.notion.so/34b07fc32f6c80faa3e7d0067ef268bc",
        properties: {
          Prenom: "Abel",
          Nom: "Simango",
          "Titre Notion": "Abel Simango",
          Photo: [
            "https://www.notion.so/image/attachment%3A7b1897ff-04ba-4e49-94ca-9634b6595086%3AAbel_Simango.jpg?table=block&id=36607fc3-2f6c-8050-aa68-cb48f49179a8&cache=v2&width=2000&spaceId=174a582a-d105-4b37-963c-91844b8ef4a1"
          ]
        }
      }
    ]);
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
                      date: { name: "Date", type: "date" },
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
                    date: [
                      [
                        "‣",
                        [
                          [
                            "d",
                            {
                              type: "date",
                              start_date: "2026-05-26"
                            }
                          ]
                        ]
                      ]
                    ],
                    nq_z: [["emstazy", [["a", "https://twitch.tv/emstazy"]]]],
                    uJKq: [["Aucun métier/entreprise"]]
                  },
                  format: {
                    page_cover: "/images/page-cover/met_william_morris_1875_willow.jpg",
                    social_media_image_preview_url:
                      "attachment:65577dd0-c9bb-4bbc-9516-796f781b7cc3:SocialMediaPreviewImage.png"
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
          Date: "2026-05-26",
          Twitch: "https://twitch.tv/emstazy",
          "Métier/entreprise": "Aucun métier/entreprise",
          Photo: [
            "https://www.notion.so/images/page-cover/met_william_morris_1875_willow.jpg",
            "https://www.notion.so/image/attachment%3A65577dd0-c9bb-4bbc-9516-796f781b7cc3%3ASocialMediaPreviewImage.png?table=block&id=35107fc3-2f6c-80c3-9da0-c5ce0cd351d3&cache=v2&width=2000"
          ]
        }
      }
    ]);
  });

  it("loads missing image child blocks with a second batch sync when syncRecordValues omits them", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const collectionId = "5bf2e238-dead-4ad6-8a19-10f4c9bfdce2";
    const viewId = "34d07fc3-2f6c-80b5-aefe-000c0049dbff";
    const characterId = "34b07fc3-2f6c-80fa-a3e7-d0067ef268bc";
    const imageBlockId = "36607fc3-2f6c-8050-aa68-cb48f49179a8";
    const calls: string[] = [];
    const fetchMock = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      if (url.endsWith("/loadPageChunk")) {
        calls.push(`load:${body.pageId}`);

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
                        collection_pointer: {
                          id: collectionId,
                          spaceId: "174a582a-d105-4b37-963c-91844b8ef4a1"
                        }
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
                        title: { name: "Nom", type: "title" }
                      }
                    }
                  }
                }
              }
            }
          });
        }

        throw new Error(`Unexpected loadPageChunk call for ${String(body.pageId)}`);
      }

      const requestedIds = body.requests?.map(
        (request: { pointer: { id: string } }) => request.pointer.id
      );
      calls.push(`sync:${requestedIds.join(",")}`);

      if (requestedIds.includes(imageBlockId)) {
        return jsonResponse({
          recordMap: {
            block: {
              [imageBlockId]: {
                value: {
                  value: {
                    id: imageBlockId,
                    type: "image",
                    space_id: "174a582a-d105-4b37-963c-91844b8ef4a1",
                    format: {
                      display_source:
                        "attachment:7b1897ff-04ba-4e49-94ca-9634b6595086:Abel_Simango.jpg"
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
                  properties: { title: [["Abel Simango"]] },
                  content: [imageBlockId],
                  format: {
                    social_media_image_preview_url:
                      "attachment:65577dd0-c9bb-4bbc-9516-796f781b7cc3:SocialMediaPreviewImage.png"
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

    expect(calls).toEqual([`load:${rootId}`, `sync:${characterId}`, `sync:${imageBlockId}`]);
    expect(input.pages).toEqual([
      {
        pageId: characterId,
        url: "https://www.notion.so/34b07fc32f6c80faa3e7d0067ef268bc",
        properties: {
          Prenom: "Abel",
          Nom: "Simango",
          "Titre Notion": "Abel Simango",
          Photo: [
            "https://www.notion.so/image/attachment%3A7b1897ff-04ba-4e49-94ca-9634b6595086%3AAbel_Simango.jpg?table=block&id=36607fc3-2f6c-8050-aa68-cb48f49179a8&cache=v2&width=2000&spaceId=174a582a-d105-4b37-963c-91844b8ef4a1"
          ]
        }
      }
    ]);
  });

  it("resolves page mentions in relation properties to the linked character titles", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const collectionId = "5bf2e238-dead-4ad6-8a19-10f4c9bfdce2";
    const viewId = "34d07fc3-2f6c-80b5-aefe-000c0049dbff";
    const characterId = "35007fc3-2f6c-8014-b39e-f9aedd61a59d";
    const parentId = "35007fc3-2f6c-8000-aaaa-bbbbbbbbbbbb";
    const siblingId = "35007fc3-2f6c-8000-cccc-dddddddddddd";
    const coupleId = "35007fc3-2f6c-8000-eeee-ffffffffffff";
    const calls: string[] = [];
    const fetchMock = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      if (url.endsWith("/loadPageChunk")) {
        calls.push(`load:${body.pageId}`);

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
                      collection_pointer: {
                        id: collectionId,
                        spaceId: "174a582a-d105-4b37-963c-91844b8ef4a1"
                      }
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
                      p1: { name: "Père relation", type: "relation" },
                      s1: { name: "Frères/Soeurs relation", type: "relation" },
                      c1: { name: "Couple relation", type: "relation" }
                    }
                  }
                }
              }
            }
          }
        });
      }

      const requestedIds = body.requests?.map(
        (request: { pointer: { id: string } }) => request.pointer.id
      );
      calls.push(`sync:${requestedIds.join(",")}`);

      if (
        requestedIds.includes(parentId) ||
        requestedIds.includes(siblingId) ||
        requestedIds.includes(coupleId)
      ) {
        return jsonResponse({
          recordMap: {
            block: {
              [parentId]: {
                value: {
                  value: {
                    id: parentId,
                    type: "page",
                    properties: { title: [["Marcus Campbell"]] }
                  }
                }
              },
              [siblingId]: {
                value: {
                  value: {
                    id: siblingId,
                    type: "page",
                    properties: { title: [["Tara Campbell"]] }
                  }
                }
              },
              [coupleId]: {
                value: {
                  value: {
                    id: coupleId,
                    type: "page",
                    properties: { title: [["Noah Rivers"]] }
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
                    title: [["Jada Campbell"]],
                    p1: [["‣", [["p", parentId]]]],
                    s1: [["‣", [["p", siblingId]]]],
                    c1: [["‣", [["p", coupleId]]]]
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

    expect(calls).toEqual([
      `load:${rootId}`,
      `sync:${characterId}`,
      `sync:${parentId},${siblingId},${coupleId}`
    ]);
    expect(input.pages).toEqual([
      {
        pageId: characterId,
        url: "https://www.notion.so/35007fc32f6c8014b39ef9aedd61a59d",
        properties: {
          Prenom: "Jada",
          Nom: "Campbell",
          "Titre Notion": "Jada Campbell",
          "Père relation": "Marcus Campbell",
          "Frères/Soeurs relation": "Tara Campbell",
          "Couple relation": "Noah Rivers"
        }
      }
    ]);
  });

  it("hydrates nested missing mention blocks across several sync passes", async () => {
    const rootId = "34407fc3-2f6c-8096-8f3b-dedadec5253c";
    const collectionId = "5bf2e238-dead-4ad6-8a19-10f4c9bfdce2";
    const viewId = "34d07fc3-2f6c-80b5-aefe-000c0049dbff";
    const characterId = "35007fc3-2f6c-8014-b39e-f9aedd61a59d";
    const textBlockId = "text-with-mention";
    const parentId = "35007fc3-2f6c-8000-aaaa-bbbbbbbbbbbb";
    const calls: string[] = [];
    const fetchMock = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      if (url.endsWith("/loadPageChunk")) {
        calls.push(`load:${body.pageId}`);

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
                      collection_pointer: {
                        id: collectionId,
                        spaceId: "174a582a-d105-4b37-963c-91844b8ef4a1"
                      }
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
                      rel: { name: "Père relation", type: "relation" }
                    }
                  }
                }
              }
            }
          }
        });
      }

      const requestedIds = body.requests?.map(
        (request: { pointer: { id: string } }) => request.pointer.id
      );
      calls.push(`sync:${requestedIds.join(",")}`);

      if (requestedIds.includes(parentId) && requestedIds.includes(textBlockId)) {
        return jsonResponse({
          recordMap: {
            block: {
              [textBlockId]: {
                value: {
                  value: {
                    id: textBlockId,
                    type: "text",
                    properties: { title: [["‣", [["p", parentId]]]] }
                  }
                }
              },
              [parentId]: {
                value: {
                  value: {
                    id: parentId,
                    type: "page",
                    properties: { title: [["Victor Lovelace"]] }
                  }
                }
              }
            }
          }
        });
      }

      if (requestedIds.includes(parentId)) {
        return jsonResponse({
          recordMap: {
            block: {
              [parentId]: {
                value: {
                  value: {
                    id: parentId,
                    type: "page",
                    properties: { title: [["Victor Lovelace"]] }
                  }
                }
              }
            }
          }
        });
      }

      if (requestedIds.includes(textBlockId)) {
        return jsonResponse({
          recordMap: {
            block: {
              [textBlockId]: {
                value: {
                  value: {
                    id: textBlockId,
                    type: "text",
                    properties: { title: [["‣", [["p", parentId]]]] }
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
                    title: [["Jada Campbell"]],
                    rel: [["‣", [["p", parentId]]]]
                  },
                  content: [textBlockId]
                }
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

    expect(calls).toEqual([
      `load:${rootId}`,
      `sync:${characterId}`,
      `sync:${textBlockId},${parentId}`
    ]);
    expect(input.pages[0]?.properties["Père relation"]).toBe("Victor Lovelace");
  });
});
