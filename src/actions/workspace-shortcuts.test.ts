import { describe, expect, it } from "vitest";

import { getWorkspaceShortcutAction, isEditableShortcutTarget } from "@/actions/workspace-shortcuts";

describe("workspace shortcuts", () => {
  it("maps Delete and Backspace to delete selection when focus is not editable", () => {
    expect(getWorkspaceShortcutAction(keyboardEvent("Delete"))).toBe("selection.delete");
    expect(getWorkspaceShortcutAction(keyboardEvent("Backspace"))).toBe("selection.delete");
  });

  it("does not trigger Delete or Backspace shortcuts from editable targets", () => {
    expect(getWorkspaceShortcutAction(keyboardEvent("Delete", editableTarget("input")))).toBeNull();
    expect(getWorkspaceShortcutAction(keyboardEvent("Backspace", editableTarget("textarea")))).toBeNull();
    expect(getWorkspaceShortcutAction(keyboardEvent("Delete", editableTarget("select")))).toBeNull();
    expect(getWorkspaceShortcutAction(keyboardEvent("Backspace", editableTarget("div", true)))).toBeNull();
  });

  it("detects editable shortcut targets without depending on a browser DOM", () => {
    expect(isEditableShortcutTarget(editableTarget("input"))).toBe(true);
    expect(isEditableShortcutTarget(editableTarget("div", true))).toBe(true);
    expect(isEditableShortcutTarget(editableTarget("button"))).toBe(false);
  });
});

function keyboardEvent(key: string, target: EventTarget | null = null) {
  return {
    key,
    target,
    metaKey: false,
    ctrlKey: false,
  } as KeyboardEvent;
}

function editableTarget(tagName: string, isContentEditable = false) {
  return {
    tagName,
    isContentEditable,
  } as unknown as EventTarget;
}
