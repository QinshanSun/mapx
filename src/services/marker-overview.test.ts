import { describe, expect, it } from "vitest";

import { buildMarkerOverviewSnapshot } from "@/services/marker-overview";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

describe("marker overview", () => {
  it("summarizes counts and newest created markers", () => {
    const snapshot = buildMarkerOverviewSnapshot(
      [marker("marker-old", "旧点位", "2026-06-13T08:00:00Z"), marker("marker-new", "新点位", "2026-06-15T08:00:00Z")],
      [category("category-1"), category("category-2")],
      [tag("tag-1")],
      1,
    );

    expect(snapshot.markerCount).toBe(2);
    expect(snapshot.categoryCount).toBe(2);
    expect(snapshot.tagCount).toBe(1);
    expect(snapshot.recentMarkers.map((item) => item.name)).toEqual(["新点位"]);
  });
});

function marker(id: string, name: string, createdAt: string): MarkerRecord {
  return {
    id,
    projectId: "project-1",
    name,
    lng: 121.4737,
    lat: 31.2304,
    coordinateSystem: "BD09",
    address: null,
    categoryId: null,
    tagIds: [],
    note: null,
    source: "manual",
    createdAt,
    updatedAt: createdAt,
  };
}

function category(id: string): CategoryRecord {
  return {
    id,
    projectId: "project-1",
    name: id,
    color: "#2563eb",
    icon: "MapPin",
    sortOrder: 10,
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
  };
}

function tag(id: string): TagRecord {
  return {
    id,
    projectId: "project-1",
    name: id,
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
  };
}
