import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

import { callCommand } from "@/services/tauri-client";

export const UPDATE_DOWNLOAD_PAGE_URL = "https://github.com/QinshanSun/mapx/releases";

export interface AvailableAppUpdate {
  currentVersion: string;
  version: string;
  date: string | null;
  body: string | null;
}

export type AppUpdateCheckResult =
  | { status: "noUpdate" }
  | { status: "available"; update: AvailableAppUpdate };

export interface UpdateDownloadProgress {
  downloadedBytes: number;
  contentLength: number | null;
}

let pendingUpdate: Update | null = null;
let downloadedUpdate: Update | null = null;

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (!isTauri()) {
    return { status: "noUpdate" };
  }

  const update = await check({ timeout: 30_000 });

  if (!update) {
    pendingUpdate = null;
    downloadedUpdate = null;
    return { status: "noUpdate" };
  }

  pendingUpdate = update;
  downloadedUpdate = null;

  return {
    status: "available",
    update: toAvailableAppUpdate(update),
  };
}

export async function downloadAvailableAppUpdate(onProgress: (progress: UpdateDownloadProgress) => void): Promise<void> {
  if (!pendingUpdate) {
    throw new Error("NO_PENDING_UPDATE");
  }

  let downloadedBytes = 0;
  let contentLength: number | null = null;

  await pendingUpdate.download((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloadedBytes = 0;
      contentLength = event.data.contentLength ?? null;
      onProgress({ downloadedBytes, contentLength });
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress({ downloadedBytes, contentLength });
      return;
    }

    onProgress({ downloadedBytes, contentLength });
  });

  downloadedUpdate = pendingUpdate;
}

export async function installDownloadedAppUpdate(): Promise<void> {
  if (!downloadedUpdate) {
    throw new Error("NO_DOWNLOADED_UPDATE");
  }

  await downloadedUpdate.install();
  await relaunch();
}

export function openUpdateDownloadPage() {
  if (!isTauri()) {
    window.open(UPDATE_DOWNLOAD_PAGE_URL, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }

  return callCommand<void>("open_update_download_page");
}

export function getUpdateErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.includes("NO_PENDING_UPDATE")) {
    return "没有可下载的更新，请重新检查版本。";
  }

  if (rawMessage.includes("NO_DOWNLOADED_UPDATE")) {
    return "更新尚未下载完成，请先下载更新。";
  }

  if (rawMessage.toLowerCase().includes("signature")) {
    return "更新签名校验失败，已停止安装。";
  }

  if (rawMessage.toLowerCase().includes("network") || rawMessage.toLowerCase().includes("offline")) {
    return "当前网络不可用，无法检查更新。";
  }

  return "无法连接更新服务，请稍后重试或前往 GitHub Releases 手动下载。";
}

export function formatUpdateProgress(progress: UpdateDownloadProgress | null) {
  if (!progress) {
    return "准备下载更新";
  }

  if (!progress.contentLength) {
    return `已下载 ${formatBytes(progress.downloadedBytes)}`;
  }

  const percent = Math.min(100, Math.round((progress.downloadedBytes / progress.contentLength) * 100));
  return `${percent}% · ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.contentLength)}`;
}

function toAvailableAppUpdate(update: Update): AvailableAppUpdate {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date ?? null,
    body: update.body ?? null,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
