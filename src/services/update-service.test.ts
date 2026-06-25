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

import { checkForAppUpdate, formatUpdateProgress, getUpdateErrorMessage } from "@/services/update-service";

describe("update service pure helpers", () => {
  beforeEach(() => {
    tauriMocks.check.mockReset();
    tauriMocks.relaunch.mockReset();
  });

  it("maps signature failures to a blocking user message", () => {
    expect(getUpdateErrorMessage(new Error("signature verification failed"))).toBe("更新签名校验失败，已停止安装。");
  });

  it("maps missing downloaded updates to a retryable user message", () => {
    expect(getUpdateErrorMessage(new Error("NO_DOWNLOADED_UPDATE"))).toBe("更新尚未下载完成，请先下载更新。");
  });

  it("formats update download progress with a percentage when content length is known", () => {
    expect(formatUpdateProgress({ downloadedBytes: 512, contentLength: 1024 })).toBe("50% · 512 B / 1.0 KB");
  });

  it("calls the Tauri updater check and maps available update metadata", async () => {
    tauriMocks.check.mockResolvedValue({
      currentVersion: "0.1.4",
      version: "0.1.5",
      date: "2026-06-25T00:00:00Z",
      body: "稳定更新说明",
    });

    await expect(checkForAppUpdate()).resolves.toEqual({
      status: "available",
      update: {
        currentVersion: "0.1.4",
        version: "0.1.5",
        date: "2026-06-25T00:00:00Z",
        body: "稳定更新说明",
      },
    });
    expect(tauriMocks.check).toHaveBeenCalledWith({ timeout: 30_000 });
  });

  it("maps an empty Tauri updater result to no-update", async () => {
    tauriMocks.check.mockResolvedValue(null);

    await expect(checkForAppUpdate()).resolves.toEqual({ status: "noUpdate" });
  });
});
