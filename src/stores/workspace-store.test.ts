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
    expect(store.getState().selectedMarkerId).toBeNull();
  });

  it("selects a marker and opens marker details", () => {
    const store = createTestStore();

    store.getState().selectMarker("mk-001");

    expect(store.getState().selectedMarkerId).toBe("mk-001");
    expect(store.getState().activePanel).toBe("markers");
  });

  it("switches workspace panels without changing the selected marker", () => {
    const store = createTestStore();

    store.getState().selectMarker("mk-001");
    store.getState().setActivePanel("settings");

    expect(store.getState().selectedMarkerId).toBe("mk-001");
    expect(store.getState().activePanel).toBe("settings");
  });
});
