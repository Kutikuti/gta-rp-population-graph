import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const scripts = import.meta.dirname;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "gta-ops-test-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, BACKUP_ROOT: join(root, "backups"), ENV_FILE: join(root, "fixture.env") };
  writeFileSync(env.ENV_FILE, "DB_NAME=test_fixture\nDB_USER=test_fixture\nDB_PASSWORD=fake-test-password\n");
  return {
    root, env,
    mock(name, body) { writeFileSync(join(bin, name), `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o700 }); },
    run(name, args = []) { return spawnSync("bash", [join(scripts, name), ...args], { env, encoding: "utf8", timeout: 15000 }); }
  };
}

test("uploads archive is private and invalid retention cannot prune it", t => {
  const f = fixture(t);
  f.env.UPLOADS_DIR = join(f.root, "characters");
  mkdirSync(f.env.UPLOADS_DIR);
  writeFileSync(join(f.env.UPLOADS_DIR, "fixture.webp"), "fixture");
  const result = f.run("backup-uploads.sh");
  assert.equal(result.status, 0, result.stderr);
  const weekly = join(f.env.BACKUP_ROOT, "weekly");
  const archives = readdirSync(weekly);
  assert.equal(archives.length, 1);
  assert.equal(statSync(join(weekly, archives[0])).mode & 0o777, 0o600);
  f.env.KEEP_WEEKLY = "0";
  assert.notEqual(f.run("backup-uploads.sh").status, 0);
  assert.deepEqual(readdirSync(weekly), archives);
});

test("packaging excludes ignored secrets and refuses uncommitted application changes", t => {
  const f = fixture(t);
  const repo = join(f.root, "source");
  mkdirSync(join(repo, "scripts"), {recursive:true});
  mkdirSync(join(repo, "backend/src"), {recursive:true});
  mkdirSync(join(repo, "web-client"), {recursive:true});
  writeFileSync(join(repo, "scripts/package-release.sh"), readFileSync(join(scripts, "package-release.sh")));
  writeFileSync(join(repo, "backend/src/index.ts"), "fixture");
  writeFileSync(join(repo, "web-client/index.html"), "fixture");
  writeFileSync(join(repo, ".node-version"), "24.20.0");
  writeFileSync(join(repo, ".gitignore"), ".env\n");
  writeFileSync(join(repo, "backend/.env"), "FAKE_SECRET=must-not-be-exported");
  const git = (...args) => {
    const result = spawnSync("git", ["-C", repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {encoding:"utf8"});
    assert.equal(result.status, 0, result.stderr);
  };
  git("init"); git("add", "."); git("commit", "-m", "Fixture");
  const archive = join(f.root, "release.tar.gz");
  const run = output => spawnSync("bash", [join(repo, "scripts/package-release.sh"), output], {encoding:"utf8", timeout:15000});
  const result = run(archive);
  assert.equal(result.status, 0, result.stderr);
  const listing = spawnSync("tar", ["-tzf", archive], {encoding:"utf8"});
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /backend\/src\/index.ts/);
  assert.doesNotMatch(listing.stdout, /\.env|\.git\//);
  writeFileSync(join(repo, "backend/src/index.ts"), "unvalidated change");
  assert.notEqual(run(join(f.root, "invalid.tar.gz")).status, 0);
});
