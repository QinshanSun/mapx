import { invoke, isTauri } from "@tauri-apps/api/core";

export function recordMapLoadFailure(code: string) {
  if (!isTauri()) {
    return Promise.resolve();
  }

  return invoke("record_map_load_failure", { code }).catch(() => undefined);
}
