import { describe, expect, it } from "vitest";

import { buildMarkerFilterSummary, filterAndSortMarkers, hasActiveMarkerFilters, type MarkerListFilters } from "@/services/marker-list";
import type { MarkerRecord } from "@/types/marker";

const baseFilters: MarkerListFilters = {
  categoryId: "all",
  tagId: "all",
  sortKey: "updatedDesc",
};

describe("marker list filters", () => {
  it("filters by category and uncategorized state", () => {
    const markers = [
      marker("marker-1", "客户A", "category-a"),
      marker("marker-2", "未分类点位", null),
      marker("marker-3", "客户B", "category-a"),
    ];

    expect(filterAndSortMarkers(markers, { ...baseFilters, categoryId: "category-a" }).map((item) => item.id)).toEqual([
      "marker-1",
      "marker-3",
    ]);
    expect(filterAndSortMarkers(markers, { ...baseFilters, categoryId: "uncategorized" }).map((item) => item.id)).toEqual([
      "marker-2",
    ]);
  });

  it("filters by tag", () => {
    const markers = [
      marker("marker-1", "客户A", "category-a", ["tag-a"]),
      marker("marker-2", "客户B", "category-a", ["tag-b"]),
      marker("marker-3", "客户C", "category-a", ["tag-a", "tag-b"]),
    ];

    expect(filterAndSortMarkers(markers, { ...baseFilters, tagId: "tag-a" }).map((item) => item.id)).toEqual([
      "marker-1",
      "marker-3",
    ]);
  });

  it("sorts with stable observable tie breaks", () => {
    const markers = [
      marker("marker-b", "乙", "category-a", [], "2026-06-14T08:00:00Z", "2026-06-15T08:00:00Z"),
      marker("marker-a", "甲", "category-a", [], "2026-06-14T08:00:00Z", "2026-06-15T08:00:00Z"),
      marker("marker-c", "丙", "category-a", [], "2026-06-16T08:00:00Z", "2026-06-16T08:00:00Z"),
    ];

    expect(filterAndSortMarkers(markers, { ...baseFilters, sortKey: "updatedDesc" }).map((item) => item.id)).toEqual([
      "marker-c",
      "marker-a",
      "marker-b",
    ]);
    expect(filterAndSortMarkers(markers, { ...baseFilters, sortKey: "nameAsc" }).map((item) => item.name)).toEqual([
      "丙",
      "甲",
      "乙",
    ]);
  });

  it("builds a compact summary for the visible filter state", () => {
    expect(hasActiveMarkerFilters(baseFilters)).toBe(false);
    expect(buildMarkerFilterSummary(baseFilters, [], [])).toBe("全部点位 · 最近更新");

    const filters = { categoryId: "category-a", tagId: "tag-a", sortKey: "nameAsc" } as const;

    expect(hasActiveMarkerFilters(filters)).toBe(true);
    expect(
      buildMarkerFilterSummary(filters, [{ id: "category-a", name: "商圈" }], [{ id: "tag-a", name: "重点" }]),
    ).toBe("商圈 · 重点 · 名称 A-Z");
  });
});

function marker(
  id: string,
  name: string,
  categoryId: string | null,
  tagIds: string[] = [],
  createdAt = "2026-06-14T08:00:00Z",
  updatedAt = "2026-06-15T08:00:00Z",
): MarkerRecord {
  return {
    id,
    projectId: "project-1",
    name,
    lng: 121.4737,
    lat: 31.2304,
    coordinateSystem: "BD09",
    address: null,
    categoryId,
    tagIds,
    note: null,
    source: "manual",
    createdAt,
    updatedAt,
  };
}
