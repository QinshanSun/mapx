import { getUpdateErrorMessage, type AppUpdateCheckResult, type AvailableAppUpdate, type UpdateDownloadProgress } from "@/services/update-service";

export type UpdateCheckTrigger = "startup" | "manual";

export type AppUpdateState =
  | { status: "idle" }
  | { status: "checking"; trigger: UpdateCheckTrigger }
  | { status: "noUpdate"; trigger: UpdateCheckTrigger }
  | { status: "available"; trigger: UpdateCheckTrigger; update: AvailableAppUpdate }
  | { status: "downloading"; update: AvailableAppUpdate; progress: UpdateDownloadProgress | null }
  | { status: "downloaded"; update: AvailableAppUpdate }
  | { status: "failed"; trigger: UpdateCheckTrigger | null; update: AvailableAppUpdate | null; message: string; visibleToUser: boolean; canOpenDownloadPage: boolean };

export type FailedUpdateState = Extract<AppUpdateState, { status: "failed" }>;

export const initialUpdateState: AppUpdateState = { status: "idle" };

export function startUpdateCheck(trigger: UpdateCheckTrigger): AppUpdateState {
  return { status: "checking", trigger };
}

export function resolveUpdateCheck(trigger: UpdateCheckTrigger, result: AppUpdateCheckResult): AppUpdateState {
  if (result.status === "noUpdate") {
    return { status: "noUpdate", trigger };
  }

  return { status: "available", trigger, update: result.update };
}

export function failUpdateCheck(trigger: UpdateCheckTrigger, error: unknown): FailedUpdateState {
  return {
    status: "failed",
    trigger,
    update: null,
    message: getUpdateErrorMessage(error),
    visibleToUser: trigger === "manual",
    canOpenDownloadPage: trigger === "manual",
  };
}

export function startUpdateDownload(update: AvailableAppUpdate): AppUpdateState {
  return { status: "downloading", update, progress: null };
}

export function progressUpdateDownload(state: AppUpdateState, progress: UpdateDownloadProgress): AppUpdateState {
  if (state.status !== "downloading") {
    return state;
  }

  return { ...state, progress };
}

export function finishUpdateDownload(update: AvailableAppUpdate): AppUpdateState {
  return { status: "downloaded", update };
}

export function failUpdateDownload(update: AvailableAppUpdate | null, error: unknown): FailedUpdateState {
  return {
    status: "failed",
    trigger: null,
    update,
    message: getUpdateErrorMessage(error),
    visibleToUser: true,
    canOpenDownloadPage: true,
  };
}

export function shouldShowUpdateDialog(state: AppUpdateState) {
  return state.status === "available" || state.status === "downloading" || state.status === "downloaded" || (state.status === "failed" && state.visibleToUser);
}
