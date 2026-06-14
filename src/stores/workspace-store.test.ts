import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import { createWorkspaceState, type WorkspaceState } from "@/stores/workspace-store";

function createTestStore() {
  return createStore<WorkspaceState>()(createWorkspaceState);
}

describe("workspace store", () => {
  it("starts on the project overview", () => {
    const store = createTestStore();

    expect(store.getState().activePanel).toBe("overview");
    expect(store.getState().lastActionNotice).toBeNull();
    expect(store.getState().selectedMarkerId).toBeNull();
  });

  it("selects a marker and opens marker details", () => {
    const store = createTestStore();

    store.getState().selectMarker("mk-001");

    expect(store.getState().selectedMarkerId).toBe("mk-001");
    expect(store.getState().activePanel).toBe("markers");
  });

  it("keeps marker selection and search tab state separate from marker list navigation", () => {
    const store = createTestStore();

    store.getState().setActivePanel("markers");
    store.getState().dispatchAction("search.focus", "button");

    expect(store.getState().activePanel).toBe("search");
    expect(store.getState().selectedMarkerId).toBeNull();

    store.getState().selectMarker("mk-002");

    expect(store.getState().activePanel).toBe("markers");
    expect(store.getState().selectedMarkerId).toBe("mk-002");
  });

  it("switches workspace panels without changing the selected marker", () => {
    const store = createTestStore();

    store.getState().selectMarker("mk-001");
    store.getState().setActivePanel("settings");

    expect(store.getState().selectedMarkerId).toBe("mk-001");
    expect(store.getState().activePanel).toBe("settings");
  });

  it("clears marker selection without leaving the current workspace panel", () => {
    const store = createTestStore();

    store.getState().dispatchAction("search.focus", "button");
    store.getState().selectMarker(null);

    expect(store.getState().selectedMarkerId).toBeNull();
    expect(store.getState().activePanel).toBe("search");
  });

  it("routes shortcut actions through a single dispatcher", () => {
    const store = createTestStore();

    store.getState().dispatchAction("search.focus", "shortcut");

    expect(store.getState().activePanel).toBe("search");
    expect(store.getState().lastActionNotice).toMatchObject({
      id: "search.focus",
      label: "搜索",
      source: "shortcut",
    });
  });

  it("keeps unimplemented delete actions visible instead of failing", () => {
    const store = createTestStore();

    store.getState().dispatchAction("selection.delete", "menu");

    expect(store.getState().lastActionNotice?.message).toContain("当前没有选中项");
  });
});
