import { describe, expect, it } from "vitest";

import { buildUpdaterManifest } from "./build-updater-manifest.mjs";
import { buildUpdaterFragment } from "./create-updater-fragment.mjs";

describe("updater manifest tools", () => {
  it("builds updater fragments with release asset URLs and inline signatures", () => {
    expect(
      buildUpdaterFragment({
        artifactName: "MapX.app.tar.gz",
        repo: "QinshanSun/mapx",
        signature: " signed-value ",
        tag: "v0.1.5",
        targets: ["darwin-aarch64"],
      }),
    ).toEqual({
      platforms: {
        "darwin-aarch64": {
          signature: "signed-value",
          url: "https://github.com/QinshanSun/mapx/releases/download/v0.1.5/MapX.app.tar.gz",
        },
      },
    });
  });

  it("builds latest.json only when macOS and Windows fragments are both present", () => {
    const manifest = buildUpdaterManifest({
      version: "0.1.5",
      pubDate: "2026-06-30T00:00:00Z",
      notes: "release notes",
      fragments: [
        {
          path: "macos.json",
          value: buildUpdaterFragment({
            artifactName: "MapX.app.tar.gz",
            repo: "QinshanSun/mapx",
            signature: "mac-signature",
            tag: "v0.1.5",
            targets: ["darwin-aarch64"],
          }),
        },
        {
          path: "windows.json",
          value: buildUpdaterFragment({
            artifactName: "MapX_0.1.5_x64_en-US.msi.zip",
            repo: "QinshanSun/mapx",
            signature: "windows-signature",
            tag: "v0.1.5",
            targets: ["windows-x86_64"],
          }),
        },
      ],
    });

    expect(manifest).toMatchObject({
      version: "0.1.5",
      notes: "release notes",
      pub_date: "2026-06-30T00:00:00Z",
      platforms: {
        "darwin-aarch64": { signature: "mac-signature" },
        "windows-x86_64": { signature: "windows-signature" },
      },
    });
  });

  it("rejects empty signatures and incomplete platform coverage", () => {
    expect(() =>
      buildUpdaterFragment({
        artifactName: "MapX.app.tar.gz",
        repo: "QinshanSun/mapx",
        signature: " ",
        tag: "v0.1.5",
        targets: ["darwin-aarch64"],
      }),
    ).toThrow("Signature file is empty");

    expect(() =>
      buildUpdaterManifest({
        version: "0.1.5",
        pubDate: "2026-06-30T00:00:00Z",
        notes: "release notes",
        fragments: [
          {
            path: "macos.json",
            value: buildUpdaterFragment({
              artifactName: "MapX.app.tar.gz",
              repo: "QinshanSun/mapx",
              signature: "mac-signature",
              tag: "v0.1.5",
              targets: ["darwin-aarch64"],
            }),
          },
        ],
      }),
    ).toThrow("No Windows updater platform");
  });
});
