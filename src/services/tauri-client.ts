import { invoke } from "@tauri-apps/api/core";

export async function callCommand<TResponse>(command: string, args?: Record<string, unknown>) {
  return invoke<TResponse>(command, args);
}
