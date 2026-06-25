import { describe, expect, it } from "vitest";

import { buildUpdaterLatestJson } from "./create-updater-latest-json.mjs";

const baseInput = {
  repository: "QinshanSun/mapx",
  tag: "v0.1.5",
  version: "0.1.5",
};

describe("create updater latest.json", () => {
  it("builds macOS and Windows updater manifest entries from release assets", () => {
    const latestJson = buildUpdaterLatestJson({
      ...baseInput,
      metadata: {
        publishedAt: "2026-06-25T00:00:00Z",
        body: "release notes",
        assets: [
          { name: "MapX_0.1.5_aarch64.dmg" },
          { name: "MapX.app.tar.gz" },
          { name: "MapX.app.tar.gz.sig" },
          { name: "MapX_0.1.5_x64_en-US.msi" },
          { name: "MapX_0.1.5_x64_en-US.msi.sig" },
        ],
      },
      readSignature: (assetName) => `${assetName}-signature`,
    });

    expect(latestJson).toEqual({
      version: "0.1.5",
      notes: "release notes",
      pub_date: "2026-06-25T00:00:00Z",
      platforms: {
        "darwin-aarch64": {
          signature: "MapX.app.tar.gz-signature",
          url: "https://github.com/QinshanSun/mapx/releases/download/v0.1.5/MapX.app.tar.gz",
        },
        "windows-x86_64": {
          signature: "MapX_0.1.5_x64_en-US.msi-signature",
          url: "https://github.com/QinshanSun/mapx/releases/download/v0.1.5/MapX_0.1.5_x64_en-US.msi",
        },
      },
    });
  });

  it("rejects manifests without a macOS updater bundle", () => {
    expect(() =>
      buildUpdaterLatestJson({
        ...baseInput,
        metadata: {
          publishedAt: "2026-06-25T00:00:00Z",
          assets: [{ name: "MapX_0.1.5_x64_en-US.msi" }, { name: "MapX_0.1.5_x64_en-US.msi.sig" }],
        },
        readSignature: () => "signature",
      }),
    ).toThrow("No macOS updater bundle found in release assets.");
  });

  it("rejects manifests without a Windows updater bundle", () => {
    expect(() =>
      buildUpdaterLatestJson({
        ...baseInput,
        metadata: {
          publishedAt: "2026-06-25T00:00:00Z",
          assets: [{ name: "MapX_0.1.5_aarch64.dmg" }, { name: "MapX.app.tar.gz" }, { name: "MapX.app.tar.gz.sig" }],
        },
        readSignature: () => "signature",
      }),
    ).toThrow("No Windows updater bundle found in release assets.");
  });

  it("rejects empty updater signatures", () => {
    expect(() =>
      buildUpdaterLatestJson({
        ...baseInput,
        metadata: {
          publishedAt: "2026-06-25T00:00:00Z",
          assets: [
            { name: "MapX_0.1.5_aarch64.dmg" },
            { name: "MapX.app.tar.gz" },
            { name: "MapX.app.tar.gz.sig" },
            { name: "MapX_0.1.5_x64_en-US.msi" },
            { name: "MapX_0.1.5_x64_en-US.msi.sig" },
          ],
        },
        readSignature: () => "   ",
      }),
    ).toThrow("Empty updater signature for MapX.app.tar.gz.");
  });
});
