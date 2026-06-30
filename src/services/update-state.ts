import type { AppUpdateAction, AppUpdateError, AppUpdateInfo, AppUpdateState, UpdateDownloadProgress } from "@/types/update";

type FailedAppUpdateState = Extract<AppUpdateState, { status: "failed" }>;

export const initialAppUpdateState: AppUpdateState = {
  status: "idle",
  lastCheckSource: null,
  error: null,
  update: null,
  progress: null,
};

export function appUpdateReducer(state: AppUpdateState, action: AppUpdateAction): AppUpdateState {
  switch (action.type) {
    case "check-started":
      return { status: "checking", lastCheckSource: action.source, error: null, update: null, progress: null };
    case "check-no-update":
      return { status: "no-update", lastCheckSource: action.source, error: null, update: null, progress: null };
    case "check-available":
      return { status: "available", lastCheckSource: action.source, error: null, update: action.update, progress: null };
    case "check-failed":
      return { status: "failed", lastCheckSource: action.source, error: action.error, update: null, progress: null };
    case "download-started":
      if (!state.update) {
        return state;
      }
      return {
        status: "downloading",
        lastCheckSource: state.lastCheckSource ?? "manual",
        error: null,
        update: state.update,
        progress: createProgress(0, null),
      };
    case "download-progress":
      if (!state.update) {
        return state;
      }
      return {
        status: "downloading",
        lastCheckSource: state.lastCheckSource ?? "manual",
        error: null,
        update: state.update,
        progress: createProgress(action.downloadedBytes, action.totalBytes),
      };
    case "download-finished":
      if (!state.update) {
        return state;
      }
      return {
        status: "waiting-for-restart",
        lastCheckSource: state.lastCheckSource ?? "manual",
        error: null,
        update: state.update,
        progress: state.progress ?? createProgress(0, null),
      };
    case "install-failed":
      return {
        status: "failed",
        lastCheckSource: state.lastCheckSource ?? "manual",
        error: action.error,
        update: state.update,
        progress: state.progress,
      };
  }
}

export function buildUpdateStatusViewModel(state: AppUpdateState) {
  switch (state.status) {
    case "idle":
      return { tone: "muted", title: "尚未检查更新", detail: "可以手动检查，或在启动时自动检查。" };
    case "checking":
      return { tone: "info", title: "正在检查更新", detail: "检查过程中仍可继续使用 MapX。" };
    case "no-update":
      return { tone: "success", title: "当前已是最新版本", detail: "没有可安装的新版本。" };
    case "available":
      return { tone: "info", title: `发现新版本 ${state.update.version}`, detail: summarizeReleaseNotes(state.update) };
    case "downloading":
      return { tone: "info", title: "正在下载更新", detail: formatProgress(state.progress) };
    case "waiting-for-restart":
      return { tone: "success", title: "更新已准备好", detail: "点击重启安装后，MapX 会关闭并应用新版本。" };
    case "failed":
      return { tone: "danger", title: "更新检查失败", detail: state.error.message };
  }
}

export function shouldShowManualUpdateError(state: AppUpdateState): state is FailedAppUpdateState & { lastCheckSource: "manual" } {
  return state.status === "failed" && state.lastCheckSource === "manual";
}

export function shouldShowStartupUpdateError(state: AppUpdateState): state is FailedAppUpdateState & { lastCheckSource: "startup" } {
  return state.status === "failed" && state.lastCheckSource === "startup";
}

export function createUpdateError(code: AppUpdateError["code"], message: string): AppUpdateError {
  return { code, message };
}

function createProgress(downloadedBytes: number, totalBytes: number | null): UpdateDownloadProgress {
  return {
    downloadedBytes,
    totalBytes,
    percent: totalBytes && totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
  };
}

function summarizeReleaseNotes(update: AppUpdateInfo) {
  const notes = update.notes?.trim();
  return notes ? notes.split("\n").find((line) => line.trim())?.trim() ?? notes : "可以下载并在确认后重启安装。";
}

function formatProgress(progress: UpdateDownloadProgress | null) {
  if (!progress) {
    return "正在准备下载。";
  }

  if (progress.percent === null) {
    return `${formatBytes(progress.downloadedBytes)} 已下载。`;
  }

  return `${progress.percent}% 已下载。`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
