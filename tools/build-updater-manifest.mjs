#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const required = ["version", "pubDate", "notesFile", "fragments", "output"];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing --${kebabCase(key)}`);
    }
  }

  const fragments = listJsonFiles(args.fragments).map((fragmentPath) => ({
    path: fragmentPath,
    value: JSON.parse(readFileSync(fragmentPath, "utf8")),
  }));
  const manifest = buildUpdaterManifest({
    fragments,
    notes: readFileSync(args.notesFile, "utf8").trim(),
    pubDate: args.pubDate,
    version: args.version,
  });

  writeFileSync(args.output, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function buildUpdaterManifest({ fragments, notes, pubDate, version }) {
  const platforms = {};
  for (const fragment of fragments) {
    if (!fragment.value.platforms || typeof fragment.value.platforms !== "object") {
      throw new Error(`Missing platforms object in ${fragment.path}`);
    }

    for (const [target, platform] of Object.entries(fragment.value.platforms)) {
      if (!platform.url || !platform.signature) {
        throw new Error(`Incomplete updater platform ${target} in ${fragment.path}`);
      }
      platforms[target] = platform;
    }
  }

  const platformKeys = Object.keys(platforms);
  if (platformKeys.length === 0) {
    throw new Error("No updater fragment files found");
  }

  if (!platformKeys.some((target) => target.startsWith("darwin-"))) {
    throw new Error("No macOS updater platform found in updater fragments");
  }

  if (!platformKeys.some((target) => target.startsWith("windows-"))) {
    throw new Error("No Windows updater platform found in updater fragments");
  }

  return {
    version,
    notes,
    pub_date: pubDate,
    platforms,
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    index += 1;

    parsed[camelCase(key.slice(2))] = value;
  }

  return parsed;
}

function listJsonFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(entryPath);
    }
    return entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
