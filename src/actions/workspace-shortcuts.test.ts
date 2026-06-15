import { describe, expect, it } from "vitest";

import { getWorkspaceShortcutAction, isEditableShortcutTarget } from "@/actions/workspace-shortcuts";

describe("workspace shortcuts", () => {
  it("maps Cmd/Ctrl+F to the global search action", () => {
    expect(getWorkspaceShortcutAction(keyboardEvent("f", null, { metaKey: true }))).toBe("search.focus");
    expect(getWorkspaceShortcutAction(keyboardEvent("F", null, { ctrlKey: true }))).toBe("search.focus");
  });

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

function keyboardEvent(key: string, target: EventTarget | null = null, modifiers: Partial<KeyboardEvent> = {}) {
  return {
    key,
    target,
    metaKey: false,
    ctrlKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

function editableTarget(tagName: string, isContentEditable = false) {
  return {
    tagName,
    isContentEditable,
  } as unknown as EventTarget;
}
