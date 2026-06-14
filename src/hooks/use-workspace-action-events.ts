import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { getActionFromMenuPayload, getWorkspaceShortcutAction } from "@/actions/workspace-shortcuts";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WORKSPACE_MENU_EVENT } from "@/types/workspace-actions";

export function useWorkspaceActionEvents() {
  const dispatchAction = useWorkspaceStore((state) => state.dispatchAction);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const actionId = getWorkspaceShortcutAction(event);

      if (!actionId) {
        return;
      }

      event.preventDefault();
      dispatchAction(actionId, "shortcut");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatchAction]);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    listen(WORKSPACE_MENU_EVENT, (event) => {
      const actionId = getActionFromMenuPayload(event.payload);

      if (actionId) {
        dispatchAction(actionId, "menu");
      }
    }).then((cleanup) => {
      if (isActive) {
        unlisten = cleanup;
      } else {
        cleanup();
      }
    }).catch(() => {
      // Browser-only Vite sessions do not have the Tauri event bridge.
    });

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, [dispatchAction]);
}
