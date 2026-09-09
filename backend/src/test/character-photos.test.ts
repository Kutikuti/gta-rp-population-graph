import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  createCharacterPhotoDraft,
  deleteStoredCharacterPhoto,
  InvalidCharacterPhotoError,
  importCharacterPhotoFromRemoteUrl
} from "../services/character-photos.js";

const userId = "00000000-0000-4000-8000-000000000911";
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("character photo validation", () => {
  it("rejects SVG uploads", async () => {
    await expect(
      createCharacterPhotoDraft({
        userId,
        contentType: "image/svg+xml",
        buffer: Buffer.from("<svg><script>alert(1)</script></svg>")
      })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
  });

  it("rejects files with an invalid image signature", async () => {
    await expect(
      createCharacterPhotoDraft({
        userId,
        contentType: "image/png",
        buffer: Buffer.from("not an image")
      })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
  });

  it("rejects files whose MIME type does not match the signature", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: "#0e72c9"
      }
    })
      .png()
      .toBuffer();

    await expect(
      createCharacterPhotoDraft({
        userId,
        contentType: "image/jpeg",
        buffer: png
      })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
  });

  it("rejects unreadable images even when the signature looks valid", async () => {
    await expect(
      createCharacterPhotoDraft({
        userId,
        contentType: "image/png",
        buffer: Buffer.concat([pngSignature, Buffer.from("broken")])
      })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
  });

  it("imports a remote notion photo through the secured pipeline", async () => {
    const png = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#0e72c9"
      }
    })
      .png()
      .toBuffer();

    let requestInit: RequestInit | undefined;
    const photoUrl = await importCharacterPhotoFromRemoteUrl({
      url: "https://www.notion.so/image/test.png",
      fetchImpl: async (_url, init) => {
        requestInit = init;

        return new Response(png, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(png.byteLength)
          }
        });
      }
    });

    expect(photoUrl).toMatch(/^\/uploads\/characters\/[0-9a-f-]+\.webp$/u);
    expect(requestInit?.headers).toMatchObject({
      accept: "image/jpeg,image/png,image/webp",
      "user-agent": "GTA-RP-Population-Graph/1.0 (+https://gta-rp.f1prediction.fr)"
    });
    expect(requestInit?.redirect).toBe("manual");
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
    await deleteStoredCharacterPhoto(photoUrl);
  });

  it("rejects remote photos outside the Notion allowlist", async () => {
    await expect(
      importCharacterPhotoFromRemoteUrl({
        url: "https://example.com/ada.png"
      })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
  });

  it.each([
    "http://www.notion.so/image/test.png",
    "https://www.notion.so:8443/image/test.png",
    "https://user:password@www.notion.so/image/test.png",
    "https://www.notion.so.evil.test/image/test.png",
    "https://127.0.0.1/photo.png"
  ])("rejects untrusted URL %s before any request", async (url) => {
    const fetchImpl = vi.fn();
    await expect(importCharacterPhotoFromRemoteUrl({ url, fetchImpl })).rejects.toBeInstanceOf(
      InvalidCharacterPhotoError
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/private",
    "https://evil.test/photo"
  ])("does not follow an untrusted redirect to %s", async (location) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    await expect(
      importCharacterPhotoFromRemoteUrl({ url: "https://www.notion.so/photo", fetchImpl })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounds redirect loops", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(
        async () => new Response(null, { status: 307, headers: { location: "/photo" } })
      );
    await expect(
      importCharacterPhotoFromRemoteUrl({ url: "https://www.notion.so/photo", fetchImpl })
    ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it.each([true, false])(
    "cancels oversized remote bodies (declared length: %s)",
    async (declaredLength) => {
      const cancel = vi.fn();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(3_000_000));
        },
        cancel
      });
      const fetchImpl = async () =>
        new Response(body, {
          headers: {
            "content-type": "image/png",
            ...(declaredLength ? { "content-length": "3000000" } : {})
          }
        });
      await expect(
        importCharacterPhotoFromRemoteUrl({ url: "https://www.notion.so/photo", fetchImpl })
      ).rejects.toBeInstanceOf(InvalidCharacterPhotoError);
      expect(cancel).toHaveBeenCalledOnce();
    }
  );
});
