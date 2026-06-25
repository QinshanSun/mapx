#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [metadataPath, signaturesDir, outputPath] = process.argv.slice(2);

if (!metadataPath || !signaturesDir || !outputPath) {
  console.error("Usage: create-updater-latest-json <release-metadata.json> <signatures-dir> <output.json>");
  process.exit(1);
}

const tag = requiredEnv("TAG_NAME");
const version = requiredEnv("VERSION");
const repository = requiredEnv("REPOSITORY");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const assets = metadata.assets ?? [];
const assetNames = assets.map((asset) => asset.name).filter(Boolean);

const platforms = {};
const macBundle = findAsset((name) => name.endsWith(".app.tar.gz"));
if (macBundle) {
  const macDmg = findAsset((name) => name.endsWith(".dmg") && name.includes(`_${version}_`));
  platforms[resolveMacPlatform(macDmg)] = buildPlatform(macBundle);
}

const windowsMsi = findAsset((name) => name.endsWith(".msi"));
if (windowsMsi) {
  platforms[resolveWindowsPlatform(windowsMsi)] = buildPlatform(windowsMsi);
}

const platformKeys = Object.keys(platforms);
if (platformKeys.length === 0) {
  throw new Error("No updater bundles found in release assets.");
}

if (!platformKeys.some((key) => key.startsWith("darwin-"))) {
  throw new Error("No macOS updater bundle found in release assets.");
}

if (!platformKeys.some((key) => key.startsWith("windows-"))) {
  throw new Error("No Windows updater bundle found in release assets.");
}

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      version,
      notes: metadata.body ?? "",
      pub_date: metadata.publishedAt ?? new Date().toISOString(),
      platforms,
    },
    null,
    2,
  )}\n`,
);

function findAsset(predicate) {
  return assetNames.find((name) => !name.endsWith(".sig") && predicate(name));
}

function buildPlatform(assetName) {
  const signature = readFileSync(path.join(signaturesDir, `${assetName}.sig`), "utf8").trim();

  if (!signature) {
    throw new Error(`Empty updater signature for ${assetName}.`);
  }

  return {
    signature,
    url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(assetName)}`,
  };
}

function resolveMacPlatform(assetName) {
  if (assetName?.includes("_aarch64.")) {
    return "darwin-aarch64";
  }

  if (assetName?.includes("_x64.")) {
    return "darwin-x86_64";
  }

  throw new Error("Cannot infer macOS updater platform from DMG asset name.");
}

function resolveWindowsPlatform(assetName) {
  if (assetName.includes("x64") || assetName.includes("x86_64")) {
    return "windows-x86_64";
  }

  if (assetName.includes("ia32") || assetName.includes("x86")) {
    return "windows-i686";
  }

  return "windows-x86_64";
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }

  return value;
}
