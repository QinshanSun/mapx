import { describe, expect, it } from "vitest";

import {
  failUpdateCheck,
  failUpdateDownload,
  finishUpdateDownload,
  initialUpdateState,
  progressUpdateDownload,
  resolveUpdateCheck,
  shouldShowUpdateDialog,
  startUpdateCheck,
  startUpdateDownload,
} from "@/services/update-state";
import type { AvailableAppUpdate } from "@/services/update-service";

const update: AvailableAppUpdate = {
  currentVersion: "0.1.4",
  version: "0.1.5",
  date: "2026-06-25T00:00:00Z",
  body: "更新说明",
};

describe("update state machine", () => {
  it("starts idle and enters checking state for manual checks", () => {
    expect(initialUpdateState).toEqual({ status: "idle" });
    expect(startUpdateCheck("manual")).toEqual({ status: "checking", trigger: "manual" });
  });

  it("resolves no-update and available check results", () => {
    expect(resolveUpdateCheck("manual", { status: "noUpdate" })).toEqual({ status: "noUpdate", trigger: "manual" });
    expect(resolveUpdateCheck("startup", { status: "available", update })).toEqual({ status: "available", trigger: "startup", update });
  });

  it("keeps startup check failures silent but manual failures visible", () => {
    const startupFailure = failUpdateCheck("startup", new Error("network unavailable"));
    const manualFailure = failUpdateCheck("manual", new Error("network unavailable"));

    expect(startupFailure).toMatchObject({ status: "failed", visibleToUser: false, canOpenDownloadPage: false });
    expect(shouldShowUpdateDialog(startupFailure)).toBe(false);
    expect(manualFailure).toMatchObject({ status: "failed", visibleToUser: true, canOpenDownloadPage: true });
    expect(shouldShowUpdateDialog(manualFailure)).toBe(true);
  });

  it("tracks downloading progress and enters downloaded waiting-for-restart state", () => {
    const downloading = startUpdateDownload(update);
    const progressed = progressUpdateDownload(downloading, { downloadedBytes: 512, contentLength: 1024 });

    expect(downloading).toEqual({ status: "downloading", update, progress: null });
    expect(progressed).toEqual({ status: "downloading", update, progress: { downloadedBytes: 512, contentLength: 1024 } });
    expect(finishUpdateDownload(update)).toEqual({ status: "downloaded", update });
  });

  it("keeps stale progress events from changing non-download states", () => {
    const available = resolveUpdateCheck("manual", { status: "available", update });

    expect(progressUpdateDownload(available, { downloadedBytes: 512, contentLength: 1024 })).toBe(available);
  });

  it("turns download and signature failures into visible failed states", () => {
    expect(failUpdateDownload(update, new Error("signature verification failed"))).toMatchObject({
      status: "failed",
      update,
      visibleToUser: true,
      canOpenDownloadPage: true,
      message: "更新签名校验失败，已停止安装。",
    });
  });
});
