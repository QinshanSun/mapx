#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { arch, homedir, platform, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandEnv = {
  ...process.env,
  PATH: [path.join(homedir(), ".cargo", "bin"), process.env.PATH].filter(Boolean).join(path.delimiter),
};

if (platform() !== "darwin") {
  run("tauri", ["build"], { cwd: repoRoot });
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;
const targetArch = arch() === "arm64" ? "aarch64" : "x64";
const bundleRoot = path.join(repoRoot, "src-tauri", "target", "release", "bundle");
const macosBundleDir = path.join(bundleRoot, "macos");
const appPath = path.join(macosBundleDir, "MapX.app");
const dmgDir = path.join(bundleRoot, "dmg");
const dmgPath = path.join(dmgDir, `MapX_${version}_${targetArch}.dmg`);
const dmgSourceDir = path.join(tmpdir(), `mapx-dmg-source-${process.pid}`);

run("tauri", ["build", "--ci", "--no-sign", "--bundles", "app"], { cwd: repoRoot });

rmSync(dmgSourceDir, { recursive: true, force: true });
rmSync(dmgPath, { force: true });
mkdirSync(dmgDir, { recursive: true });
mkdirSync(dmgSourceDir, { recursive: true });
cpSync(appPath, path.join(dmgSourceDir, "MapX.app"), { recursive: true });
symlinkSync("/Applications", path.join(dmgSourceDir, "Applications"));

run("hdiutil", ["create", "-volname", "MapX", "-srcfolder", dmgSourceDir, "-ov", "-fs", "APFS", "-format", "UDZO", dmgPath], {
  cwd: repoRoot,
});

rmSync(dmgSourceDir, { recursive: true, force: true });
console.log(`Built APFS DMG: ${path.relative(repoRoot, dmgPath)}`);

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    env: commandEnv,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
