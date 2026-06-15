#!/usr/bin/env node

import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "";
const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);

if (!match) {
  fail(`Release tag must match vX.Y.Z, received: ${tag || "<empty>"}`);
}

const version = `${match[1]}.${match[2]}.${match[3]}`;
const versions = {
  "package.json": readJson("package.json").version,
  "src-tauri/tauri.conf.json": readJson("src-tauri/tauri.conf.json").version,
  "src-tauri/Cargo.toml": readCargoPackageVersion("src-tauri/Cargo.toml"),
};
const mismatches = Object.entries(versions).filter(([, currentVersion]) => currentVersion !== version);

if (mismatches.length > 0) {
  fail(
    [`Release tag ${tag} requires version ${version}, but found:`]
      .concat(mismatches.map(([file, currentVersion]) => `- ${file}: ${currentVersion ?? "<missing>"}`))
      .join("\n"),
  );
}

console.log(`Release version verified: ${tag}`);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readCargoPackageVersion(filePath) {
  const content = readFileSync(filePath, "utf8");
  let inPackageSection = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inPackageSection = /^\s*\[package\]\s*$/.test(line);
      continue;
    }

    if (inPackageSection) {
      const version = /^\s*version\s*=\s*"([^"]+)"/.exec(line)?.[1];
      if (version) {
        return version;
      }
    }
  }

  return null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
