import { describe, expect, it } from "vitest";

import { searchLocalMarkers } from "@/services/marker-search";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

const categories: CategoryRecord[] = [category("category-customer", "客户"), category("category-store", "门店")];
const tags: TagRecord[] = [tag("tag-priority", "重点"), tag("tag-visit", "待复访")];

describe("local marker search", () => {
  it("matches marker name, address, category name, and tag name inside one project marker set", () => {
    const markers = [
      marker("marker-1", "客户总部", "上海市黄浦区", "category-customer", []),
      marker("marker-2", "普通点位", "杭州市西湖区", "category-store", ["tag-priority"]),
      marker("marker-3", "仓库", "苏州市工业园区", null, ["tag-visit"]),
    ];

    expect(searchLocalMarkers(markers, categories, tags, "总部").map((item) => item.id)).toEqual(["marker-1"]);
    expect(searchLocalMarkers(markers, categories, tags, "西湖").map((item) => item.id)).toEqual(["marker-2"]);
    expect(searchLocalMarkers(markers, categories, tags, "客户").map((item) => item.id)).toEqual(["marker-1"]);
    expect(searchLocalMarkers(markers, categories, tags, "复访").map((item) => item.id)).toEqual(["marker-3"]);
  });

  it("returns the original marker set when the keyword is empty", () => {
    const markers = [marker("marker-1", "客户总部", "上海市黄浦区", "category-customer", [])];

    expect(searchLocalMarkers(markers, categories, tags, "   ")).toBe(markers);
  });
});

function category(id: string, name: string): CategoryRecord {
  return {
    id,
    projectId: "project-1",
    name,
    color: "#2563eb",
    icon: "MapPin",
    sortOrder: 10,
    createdAt: "2026-06-14T08:00:00Z",
    updatedAt: "2026-06-14T08:00:00Z",
  };
}

function tag(id: string, name: string): TagRecord {
  return {
    id,
    projectId: "project-1",
    name,
    createdAt: "2026-06-14T08:00:00Z",
    updatedAt: "2026-06-14T08:00:00Z",
  };
}

function marker(
  id: string,
  name: string,
  address: string,
  categoryId: string | null,
  tagIds: string[],
): MarkerRecord {
  return {
    id,
    projectId: "project-1",
    name,
    lng: 121.4737,
    lat: 31.2304,
    coordinateSystem: "BD09",
    address,
    categoryId,
    tagIds,
    note: null,
    source: "manual",
    createdAt: "2026-06-14T08:00:00Z",
    updatedAt: "2026-06-15T08:00:00Z",
  };
}
