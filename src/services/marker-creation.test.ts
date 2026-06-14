import { describe, expect, it } from "vitest";

import {
  buildMarkerDraftFromPending,
  createPendingMarkerFromCenter,
  createPendingMarkerFromMapClick,
  isPendingMarkerDirty,
  pendingMarkerToFormState,
} from "@/services/marker-creation";

describe("marker creation pending state", () => {
  it("does not create pending markers from ordinary map clicks", () => {
    expect(createPendingMarkerFromMapClick("project-1", { lng: 121.5, lat: 31.2 }, false)).toBeNull();
  });

  it("creates a manual pending marker only while creation mode is active", () => {
    const pendingMarker = createPendingMarkerFromMapClick("project-1", { lng: 121.5, lat: 31.2 }, true);

    expect(pendingMarker).toEqual({
      id: "pending-marker",
      projectId: "project-1",
      lng: 121.5,
      lat: 31.2,
      source: "manual",
    });
    expect(isPendingMarkerDirty(pendingMarker)).toBe(true);
  });

  it("preserves center source and coordinates when building a marker draft", () => {
    const pendingMarker = createPendingMarkerFromCenter("project-1", { lng: 121.4737, lat: 31.2304 });
    const formState = pendingMarkerToFormState(pendingMarker);

    expect(buildMarkerDraftFromPending(pendingMarker, { ...formState, note: "  中心点  " })).toEqual({
      projectId: "project-1",
      name: "地图中心点",
      lng: 121.4737,
      lat: 31.2304,
      address: null,
      categoryId: null,
      tagIds: [],
      note: "中心点",
      source: "center",
    });
  });
});
