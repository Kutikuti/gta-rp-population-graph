import { readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";

import { env } from "./config/env.js";
import {
  characterPhotoDraftDir,
  characterPhotoDraftFilePattern
} from "./services/character-photos.js";

const maxAgeMs = env.PHOTO_DRAFT_MAX_AGE_HOURS * 60 * 60 * 1000;
const now = Date.now();

let scanned = 0;
let skipped = 0;
let deleted = 0;

try {
  const entries = await readdir(characterPhotoDraftDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !characterPhotoDraftFilePattern.test(entry.name)) {
      skipped += 1;
      continue;
    }

    scanned += 1;
    const filePath = resolve(characterPhotoDraftDir, entry.name);
    const fileStat = await stat(filePath);

    if (now - fileStat.mtimeMs < maxAgeMs) {
      continue;
    }

    await unlink(filePath);
    deleted += 1;
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

console.log(
  `Photo draft cleanup complete: scanned=${String(scanned)} deleted=${String(
    deleted
  )} skipped=${String(skipped)} maxAgeHours=${String(env.PHOTO_DRAFT_MAX_AGE_HOURS)}`
);
