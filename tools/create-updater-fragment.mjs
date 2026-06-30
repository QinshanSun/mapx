#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const required = ["repo", "tag", "artifact", "signature", "output"];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing --${key}`);
    }
  }

  const signature = readFileSync(args.signature, "utf8").trim();
  const fragment = buildUpdaterFragment({
    artifactName: path.basename(args.artifact),
    repo: args.repo,
    signature,
    tag: args.tag,
    targets: args.target,
  });

  mkdirSync(path.dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(fragment, null, 2)}\n`);
}

export function buildUpdaterFragment({ artifactName, repo, signature, tag, targets }) {
  if (!targets.length) {
    throw new Error("At least one --target is required");
  }

  if (!signature.trim()) {
    throw new Error(`Signature file is empty for ${artifactName}`);
  }

  const artifactUrl = `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(artifactName)}`;
  const platforms = Object.fromEntries(targets.map((target) => [target, { url: artifactUrl, signature: signature.trim() }]));

  return { platforms };
}

function parseArgs(argv) {
  const parsed = { target: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }

    const name = key.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    index += 1;

    if (name === "target") {
      parsed.target.push(value);
    } else {
      parsed[name] = value;
    }
  }

  return parsed;
}
