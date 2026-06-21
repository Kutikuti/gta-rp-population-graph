import { randomUUID } from "node:crypto";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

import { env } from "../config/env.js";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const contentTypeFormats = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp"
} as const;
const pendingPhotoPattern =
  /^pending-photo:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;

const storageRoot = resolve(process.cwd(), env.PHOTO_STORAGE_DIR);
const tmpDir = resolve(storageRoot, "tmp");
const characterDir = resolve(storageRoot, "characters");

export const characterPhotoPublicPath = (fileName: string) => `/uploads/characters/${fileName}`;
export const characterPhotoPublicDir = characterDir;
export const characterPhotoDraftDir = tmpDir;
export const characterPhotoDraftFilePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/u;

export class InvalidCharacterPhotoError extends Error {
  constructor(message = "Invalid character photo.") {
    super(message);
  }
}

const detectSignatureFormat = (buffer: Buffer) => {
  const isJpeg =
    buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  if (isJpeg) {
    return "jpeg";
  }

  if (isPng) {
    return "png";
  }

  if (isWebp) {
    return "webp";
  }

  return null;
};

const pendingPhotoPath = (userId: string, photoId: string) =>
  resolve(tmpDir, `${userId}.${photoId}.webp`);

const parsePendingPhotoToken = (value: string) => {
  const match = pendingPhotoPattern.exec(value);

  if (!match) {
    return null;
  }

  const [, userId, photoId] = match;

  if (!userId || !photoId) {
    return null;
  }

  return {
    userId,
    photoId
  };
};

export const isPendingCharacterPhotoToken = (value: string | null | undefined): value is string =>
  typeof value === "string" && Boolean(parsePendingPhotoToken(value));

export const assertPendingCharacterPhotoExists = async (
  photoUrl: string,
  expectedUserId: string
) => {
  const parsed = parsePendingPhotoToken(photoUrl);

  if (!parsed || parsed.userId !== expectedUserId) {
    throw new InvalidCharacterPhotoError("Photo temporaire invalide.");
  }

  await stat(pendingPhotoPath(parsed.userId, parsed.photoId));
};

export const createCharacterPhotoDraft = async (input: {
  userId: string;
  buffer: Buffer;
  contentType: string;
}) => {
  const signatureFormat = detectSignatureFormat(input.buffer);
  const expectedFormat = contentTypeFormats[input.contentType as keyof typeof contentTypeFormats];

  if (
    !allowedContentTypes.has(input.contentType) ||
    !signatureFormat ||
    signatureFormat !== expectedFormat
  ) {
    throw new InvalidCharacterPhotoError("Format d'image refuse.");
  }

  const image = sharp(input.buffer, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 16_000_000
  });
  let metadata: sharp.Metadata;

  try {
    metadata = await image.metadata();
  } catch {
    throw new InvalidCharacterPhotoError("Image illisible.");
  }

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new InvalidCharacterPhotoError("Image illisible.");
  }

  if (!["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new InvalidCharacterPhotoError("Format d'image refuse.");
  }

  const photoId = randomUUID();
  const fileName = `${input.userId}.${photoId}.webp`;
  const filePath = resolve(tmpDir, fileName);

  await mkdir(tmpDir, { recursive: true });
  const output = await image
    .rotate()
    .resize(512, 512, { fit: "cover", position: "centre" })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();

  await writeFile(filePath, output, { flag: "wx" });

  return {
    photoUrl: `pending-photo:${input.userId}:${photoId}`
  };
};

export const promoteCharacterPhotoIfPending = async (photoUrl: string | null) => {
  if (!photoUrl) {
    return photoUrl;
  }

  const parsed = parsePendingPhotoToken(photoUrl);

  if (!parsed) {
    return photoUrl;
  }

  await mkdir(characterDir, { recursive: true });
  const finalFileName = `${parsed.photoId}.webp`;
  await rename(
    pendingPhotoPath(parsed.userId, parsed.photoId),
    resolve(characterDir, finalFileName)
  );

  return characterPhotoPublicPath(finalFileName);
};

export const deletePendingCharacterPhoto = async (photoUrl: string | null | undefined) => {
  if (!photoUrl) {
    return;
  }

  const parsed = parsePendingPhotoToken(photoUrl);

  if (!parsed) {
    return;
  }

  try {
    await unlink(pendingPhotoPath(parsed.userId, parsed.photoId));
  } catch {
    // Best-effort cleanup: the moderation decision must not fail because a temp file already vanished.
  }
};
