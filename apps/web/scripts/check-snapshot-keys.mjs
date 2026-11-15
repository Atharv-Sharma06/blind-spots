#!/usr/bin/env node
// Parity check: every key in public/snapshot/manifest.json must round-trip through snapshotKey
// (parse the key, rebuild it with lib/snapshot.ts, compare). Exits 0 when the manifest is absent.
// Usage: node scripts/check-snapshot-keys.mjs [path/to/manifest.json]
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotKey, parseSnapshotKey } from "../lib/snapshot.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.argv[2] ?? join(root, "public", "snapshot", "manifest.json");

if (!existsSync(manifestPath)) {
  console.log(`check-snapshot-keys: no manifest at ${manifestPath}; nothing to check.`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const keys = Object.keys(manifest.entries ?? {});
const dir = dirname(manifestPath);
let bad = 0;
let missingFiles = 0;
for (const key of keys) {
  const parsed = parseSnapshotKey(key);
  const rebuilt = parsed ? snapshotKey(parsed.method, parsed.path, parsed.method === "GET" ? parsed.query : parsed.body) : null;
  if (rebuilt !== key) {
    bad += 1;
    if (bad <= 10) console.error(`key does not round-trip:\n  manifest: ${key}\n  rebuilt : ${rebuilt}`);
  }
  if (!existsSync(join(dir, manifest.entries[key]))) {
    missingFiles += 1;
    if (missingFiles <= 10) console.error(`missing file for ${key}: ${manifest.entries[key]}`);
  }
}
console.log(`check-snapshot-keys: ${keys.length} keys, ${bad} not round-tripping, ${missingFiles} missing files.`);
process.exit(bad || missingFiles ? 1 : 0);
