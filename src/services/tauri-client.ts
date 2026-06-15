import { invoke, isTauri } from "@tauri-apps/api/core";

export async function callCommand<TResponse>(command: string, args?: Record<string, unknown>) {
  try {
    return await invoke<TResponse>(command, args);
  } catch (error) {
    recordCommandError(command, error);
    throw error;
  }
}

function recordCommandError(command: string, error: unknown) {
  if (!isTauri() || command === "record_command_error") {
    return;
  }

  void invoke("record_command_error", {
    commandName: command,
    errorCode: readErrorCode(error),
  }).catch(() => undefined);
}

function readErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return "UNKNOWN";
}
