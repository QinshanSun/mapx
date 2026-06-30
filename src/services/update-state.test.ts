import { describe, expect, it } from "vitest";

import { appUpdateReducer, buildUpdateStatusViewModel, createUpdateError, initialAppUpdateState, shouldShowManualUpdateError, shouldShowStartupUpdateError } from "@/services/update-state";
import type { AppUpdateInfo } from "@/types/update";

const update: AppUpdateInfo = {
  version: "0.2.0",
  currentVersion: "0.1.4",
  publishedAt: "2026-06-30T00:00:00Z",
  notes: "新增自动更新。\n修复发布流程。",
};

describe("app update state", () => {
  it("starts from idle and enters checking during manual checks", () => {
    expect(initialAppUpdateState.status).toBe("idle");

    const state = appUpdateReducer(initialAppUpdateState, { type: "check-started", source: "manual" });

    expect(state.status).toBe("checking");
    expect(buildUpdateStatusViewModel(state).title).toBe("正在检查更新");
  });

  it("returns no-update after a successful manual check with no release", () => {
    const checking = appUpdateReducer(initialAppUpdateState, { type: "check-started", source: "manual" });
    const state = appUpdateReducer(checking, { type: "check-no-update", source: "manual" });

    expect(state.status).toBe("no-update");
    expect(buildUpdateStatusViewModel(state).title).toBe("当前已是最新版本");
  });

  it("exposes update metadata when a release is available", () => {
    const state = appUpdateReducer(initialAppUpdateState, { type: "check-available", source: "manual", update });

    expect(state.status).toBe("available");
    if (state.status !== "available") {
      throw new Error("Expected update metadata after an available update check.");
    }
    expect(state.update.version).toBe("0.2.0");
    expect(buildUpdateStatusViewModel(state).detail).toBe("新增自动更新。");
  });

  it("tracks download progress and waits for explicit restart", () => {
    const available = appUpdateReducer(initialAppUpdateState, { type: "check-available", source: "manual", update });
    const downloading = appUpdateReducer(available, { type: "download-progress", downloadedBytes: 50, totalBytes: 100 });
    const downloaded = appUpdateReducer(downloading, { type: "download-finished" });

    expect(downloading.status).toBe("downloading");
    expect(downloading.progress?.percent).toBe(50);
    expect(downloaded.status).toBe("waiting-for-restart");
    expect(buildUpdateStatusViewModel(downloaded).title).toBe("更新已准备好");
  });

  it("keeps startup check failures non-manual", () => {
    const state = appUpdateReducer(initialAppUpdateState, {
      type: "check-failed",
      source: "startup",
      error: createUpdateError("OFFLINE", "无法连接到 GitHub 更新服务，请检查网络后重试。"),
    });

    expect(shouldShowStartupUpdateError(state)).toBe(true);
    expect(shouldShowManualUpdateError(state)).toBe(false);
  });

  it("marks manual check failures as user-visible", () => {
    const state = appUpdateReducer(initialAppUpdateState, {
      type: "check-failed",
      source: "manual",
      error: createUpdateError("SIGNATURE_INVALID", "更新签名校验失败，已停止安装。"),
    });

    expect(shouldShowManualUpdateError(state)).toBe(true);
    expect(buildUpdateStatusViewModel(state).detail).toContain("签名");
  });
});
