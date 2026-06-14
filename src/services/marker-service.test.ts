import { describe, expect, it } from "vitest";

import { createMarker, listProjectMarkers, searchProjectMarkers } from "@/services/marker-service";

describe("marker service browser preview state", () => {
  it("keeps saved search markers visible in local list and search results", async () => {
    const projectId = "preview-project-srch-005";

    await createMarker({
      projectId,
      name: "人民广场",
      lng: 121.475,
      lat: 31.234,
      address: "上海市黄浦区人民大道",
      categoryId: null,
      tagIds: [],
      note: "搜索保存",
      source: "search",
    });

    const markers = await listProjectMarkers(projectId);
    const searchResults = await searchProjectMarkers(projectId, "人民广场");

    expect(markers[0]).toMatchObject({
      name: "人民广场",
      address: "上海市黄浦区人民大道",
      source: "search",
    });
    expect(searchResults[0]?.name).toBe("人民广场");
  });

  it("allows duplicate marker names in browser preview mode", async () => {
    const projectId = "preview-project-duplicate-names";

    await createMarker({ projectId, name: "同名地点", lng: 121.47, lat: 31.23, source: "search" });
    await createMarker({ projectId, name: "同名地点", lng: 121.48, lat: 31.24, source: "search" });

    const searchResults = await searchProjectMarkers(projectId, "同名地点");

    expect(searchResults.filter((marker) => marker.name === "同名地点")).toHaveLength(2);
  });
});
