import { isWorkspaceActionId, type WorkspaceActionId } from "@/types/workspace-actions";

export function getWorkspaceShortcutAction(event: KeyboardEvent): WorkspaceActionId | null {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const key = event.key.toLowerCase();
  const hasCommandModifier = event.metaKey || event.ctrlKey;

  if (hasCommandModifier && key === "n") {
    return "project.new";
  }

  if (hasCommandModifier && key === "f") {
    return "search.focus";
  }

  if (hasCommandModifier && key === "s") {
    return "changes.save";
  }

  if (key === "escape") {
    return "mode.cancel";
  }

  if (key === "delete" || key === "backspace") {
    return "selection.delete";
  }

  return null;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function getActionFromMenuPayload(payload: unknown): WorkspaceActionId | null {
  if (!payload || typeof payload !== "object" || !("actionId" in payload)) {
    return null;
  }

  const actionId = payload.actionId;
  return typeof actionId === "string" && isWorkspaceActionId(actionId) ? actionId : null;
}
