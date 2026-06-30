export type UpdateCheckSource = "startup" | "manual";

export interface AppUpdateInfo {
  version: string;
  currentVersion: string;
  publishedAt: string | null;
  notes: string | null;
}

export interface AppUpdateError {
  code: UpdateErrorCode;
  message: string;
}

export type UpdateErrorCode = "OFFLINE" | "SIGNATURE_INVALID" | "INSTALL_FAILED" | "UPDATER_UNAVAILABLE" | "UNKNOWN";

export type AppUpdateState =
  | { status: "idle"; lastCheckSource: UpdateCheckSource | null; error: null; update: null; progress: null }
  | { status: "checking"; lastCheckSource: UpdateCheckSource; error: null; update: null; progress: null }
  | { status: "no-update"; lastCheckSource: UpdateCheckSource; error: null; update: null; progress: null }
  | { status: "available"; lastCheckSource: UpdateCheckSource; error: null; update: AppUpdateInfo; progress: null }
  | { status: "downloading"; lastCheckSource: UpdateCheckSource; error: null; update: AppUpdateInfo; progress: UpdateDownloadProgress }
  | { status: "waiting-for-restart"; lastCheckSource: UpdateCheckSource; error: null; update: AppUpdateInfo; progress: UpdateDownloadProgress }
  | { status: "failed"; lastCheckSource: UpdateCheckSource; error: AppUpdateError; update: AppUpdateInfo | null; progress: UpdateDownloadProgress | null };

export interface UpdateDownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export type AppUpdateAction =
  | { type: "check-started"; source: UpdateCheckSource }
  | { type: "check-no-update"; source: UpdateCheckSource }
  | { type: "check-available"; source: UpdateCheckSource; update: AppUpdateInfo }
  | { type: "check-failed"; source: UpdateCheckSource; error: AppUpdateError }
  | { type: "download-started" }
  | { type: "download-progress"; downloadedBytes: number; totalBytes: number | null }
  | { type: "download-finished" }
  | { type: "install-failed"; error: AppUpdateError };
