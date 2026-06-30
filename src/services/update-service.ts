import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

import { callCommand } from "@/services/tauri-client";
import { createUpdateError } from "@/services/update-state";
import type { AppUpdateError, AppUpdateInfo } from "@/types/update";

export const RELEASE_DOWNLOAD_URL = "https://github.com/QinshanSun/mapx/releases/latest";

let pendingUpdate: Update | null = null;
let downloadedUpdate: Update | null = null;

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isTauri()) {
    pendingUpdate = null;
    downloadedUpdate = null;
    return null;
  }

  try {
    const update = await check({ timeout: 30_000 });
    pendingUpdate = update;
    downloadedUpdate = null;
    return update ? mapUpdateInfo(update) : null;
  } catch (error) {
    throw mapUpdateError(error);
  }
}

export async function downloadPendingUpdate(onProgress: (downloadedBytes: number, totalBytes: number | null) => void) {
  if (!pendingUpdate) {
    throw createUpdateError("UPDATER_UNAVAILABLE", "没有可下载的更新，请先检查更新。");
  }

  let totalBytes: number | null = null;
  let downloadedBytes = 0;

  try {
    await pendingUpdate.download((event: DownloadEvent) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength ?? null;
        downloadedBytes = 0;
        onProgress(downloadedBytes, totalBytes);
      }

      if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        onProgress(downloadedBytes, totalBytes);
      }

      if (event.event === "Finished") {
        onProgress(totalBytes ?? downloadedBytes, totalBytes);
      }
    });
    downloadedUpdate = pendingUpdate;
  } catch (error) {
    throw mapUpdateError(error);
  }
}

export async function installDownloadedUpdateAndRelaunch() {
  if (!downloadedUpdate) {
    throw createUpdateError("UPDATER_UNAVAILABLE", "更新尚未下载完成，请先下载更新。");
  }

  if (!isTauri()) {
    return;
  }

  try {
    await downloadedUpdate.install();
    await relaunch();
  } catch (error) {
    throw mapUpdateError(error);
  }
}

export function openReleaseDownloadPage() {
  if (!isTauri()) {
    window.open(RELEASE_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }

  return callCommand<void>("open_release_download_page");
}

export function mapUpdateError(error: unknown): AppUpdateError {
  const message = readErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("signature") || lowerMessage.includes("minisign")) {
    return createUpdateError("SIGNATURE_INVALID", "更新签名校验失败，已停止安装。请从下载页面手动安装可信版本。");
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("offline") || lowerMessage.includes("dns") || lowerMessage.includes("timed out") || lowerMessage.includes("sending request") || lowerMessage.includes("error trying to connect") || lowerMessage.includes("couldn't connect") || lowerMessage.includes("connection refused") || lowerMessage.includes("tls handshake")) {
    return createUpdateError("OFFLINE", "无法连接到 GitHub 更新服务，请检查网络后重试。");
  }

  if (lowerMessage.includes("install")) {
    return createUpdateError("INSTALL_FAILED", "更新安装失败，请重试或前往下载页面手动安装。");
  }

  return createUpdateError("UNKNOWN", message || "更新失败，请稍后重试或前往下载页面手动安装。");
}

function mapUpdateInfo(update: Update): AppUpdateInfo {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    publishedAt: update.date ?? null,
    notes: update.body ?? null,
  };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "更新失败，请稍后重试或前往下载页面手动安装。";
}
