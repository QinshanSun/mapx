import { describe, expect, it } from "vitest";

import {
  buildMarkerDraftFromPending,
  createPendingMarkerFromCenter,
  createPendingMarkerFromMapClick,
  createPendingMarkerFromPoi,
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

  it("prefills Baidu POI name and address before saving a search marker", () => {
    const pendingMarker = createPendingMarkerFromPoi("project-1", {
      id: "poi-1",
      name: "人民广场",
      lng: 121.475,
      lat: 31.234,
      address: "上海市黄浦区人民大道",
      city: "上海",
      source: "baidu",
    });

    const formState = pendingMarkerToFormState(pendingMarker);

    expect(formState).toMatchObject({
      name: "人民广场",
      address: "上海市黄浦区人民大道",
    });
    expect(buildMarkerDraftFromPending(pendingMarker, { ...formState, note: "  搜索保存  " })).toMatchObject({
      projectId: "project-1",
      name: "人民广场",
      lng: 121.475,
      lat: 31.234,
      address: "上海市黄浦区人民大道",
      note: "搜索保存",
      source: "search",
    });
  });
});
