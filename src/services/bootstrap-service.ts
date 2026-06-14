import { isTauri } from "@tauri-apps/api/core";

import { callCommand } from "@/services/tauri-client";
import type { BootstrapStatus } from "@/types/bootstrap";

export function getBootstrapStatus() {
  if (!isTauri()) {
    return Promise.resolve<BootstrapStatus>({
      ready: true,
      databasePath: null,
      message: null,
    });
  }

  return callCommand<BootstrapStatus>("get_bootstrap_status");
}
