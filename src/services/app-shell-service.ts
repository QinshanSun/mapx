import { callCommand } from "@/services/tauri-client";
import type { AppShellSnapshot } from "@/types/workspace";

export function getAppShellSnapshot() {
  return callCommand<AppShellSnapshot>("get_app_shell_snapshot");
}
