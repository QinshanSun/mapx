import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: tauriMocks.relaunch,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: tauriMocks.check,
}));

import { checkForAppUpdate, downloadPendingUpdate, installDownloadedUpdateAndRelaunch, mapUpdateError } from "@/services/update-service";

describe("update service", () => {
  beforeEach(() => {
    tauriMocks.check.mockReset();
    tauriMocks.relaunch.mockReset();
  });

  it("calls the Tauri updater with a bounded timeout and maps available update metadata", async () => {
    tauriMocks.check.mockResolvedValue({
      currentVersion: "0.1.4",
      version: "0.1.5",
      date: "2026-06-25T00:00:00Z",
      body: "稳定更新说明",
    });

    await expect(checkForAppUpdate()).resolves.toEqual({
      currentVersion: "0.1.4",
      version: "0.1.5",
      publishedAt: "2026-06-25T00:00:00Z",
      notes: "稳定更新说明",
    });
    expect(tauriMocks.check).toHaveBeenCalledWith({ timeout: 30_000 });
  });

  it("maps an empty Tauri updater result to no available update", async () => {
    tauriMocks.check.mockResolvedValue(null);

    await expect(checkForAppUpdate()).resolves.toBeNull();
  });

  it("downloads first, then installs and relaunches only after explicit confirmation", async () => {
    const update = {
      currentVersion: "0.1.4",
      version: "0.1.5",
      date: "2026-06-25T00:00:00Z",
      body: "稳定更新说明",
      download: vi.fn(async (onEvent) => {
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Progress", data: { chunkLength: 40 } });
        onEvent({ event: "Finished", data: {} });
      }),
      install: vi.fn(),
    };
    const progress: Array<[number, number | null]> = [];
    tauriMocks.check.mockResolvedValue(update);

    await checkForAppUpdate();
    await downloadPendingUpdate((downloadedBytes, totalBytes) => progress.push([downloadedBytes, totalBytes]));

    expect(update.download).toHaveBeenCalledTimes(1);
    expect(update.install).not.toHaveBeenCalled();
    expect(tauriMocks.relaunch).not.toHaveBeenCalled();
    expect(progress).toEqual([
      [0, 100],
      [40, 100],
      [100, 100],
    ]);

    await installDownloadedUpdateAndRelaunch();

    expect(update.install).toHaveBeenCalledTimes(1);
    expect(tauriMocks.relaunch).toHaveBeenCalledTimes(1);
  });

  it("maps signature and offline failures to structured update errors", () => {
    expect(mapUpdateError(new Error("signature verification failed"))).toMatchObject({
      code: "SIGNATURE_INVALID",
      message: expect.stringContaining("签名"),
    });
    expect(mapUpdateError(new Error("network timed out"))).toMatchObject({
      code: "OFFLINE",
      message: expect.stringContaining("GitHub"),
    });
    expect(mapUpdateError(new Error("error sending request for url (https://github.com/QinshanSun/mapx/releases/latest/download/latest.json)"))).toMatchObject({
      code: "OFFLINE",
      message: expect.stringContaining("GitHub"),
    });
  });
});
