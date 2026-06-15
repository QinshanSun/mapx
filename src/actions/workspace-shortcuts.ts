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

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!isElementLike(target)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isEditableTarget(target: EventTarget | null) {
  return isEditableShortcutTarget(target);
}

function isElementLike(target: EventTarget | null): target is HTMLElement {
  return !!target && typeof target === "object" && "tagName" in target && "isContentEditable" in target;
}

export function getActionFromMenuPayload(payload: unknown): WorkspaceActionId | null {
  if (!payload || typeof payload !== "object" || !("actionId" in payload)) {
    return null;
  }

  const actionId = payload.actionId;
  return typeof actionId === "string" && isWorkspaceActionId(actionId) ? actionId : null;
}
