import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createCharacterPhotoDraft,
  InvalidCharacterPhotoError
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
});
