import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect } from "react";

import { getActionFromMenuPayload, getWorkspaceShortcutAction } from "@/actions/workspace-shortcuts";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WORKSPACE_MENU_EVENT, type WorkspaceActionId, type WorkspaceActionSource } from "@/types/workspace-actions";

export function useWorkspaceActionEvents(onAction?: (actionId: WorkspaceActionId, source: WorkspaceActionSource) => void) {
  const dispatchAction = useWorkspaceStore((state) => state.dispatchAction);

  const runAction = useCallback((actionId: WorkspaceActionId, source: WorkspaceActionSource) => {
    dispatchAction(actionId, source);
    onAction?.(actionId, source);
  }, [dispatchAction, onAction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const actionId = getWorkspaceShortcutAction(event);

      if (!actionId) {
        return;
      }

      event.preventDefault();
      runAction(actionId, "shortcut");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runAction]);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    listen(WORKSPACE_MENU_EVENT, (event) => {
      const actionId = getActionFromMenuPayload(event.payload);

      if (actionId) {
        runAction(actionId, "menu");
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
  }, [runAction]);
}
