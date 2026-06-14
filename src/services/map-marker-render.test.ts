import { describe, expect, it } from "vitest";

import { buildMapMarkerItems, findMarkerById } from "@/services/map-marker-render";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";

describe("map marker render items", () => {
  it("uses category color and icon for map marker styling", () => {
    expect(buildMapMarkerItems([buildMarker({ categoryId: "customer" })], [buildCategory()])).toEqual([
      {
        id: "marker-1",
        name: "客户点位",
        lng: 121.4737,
        lat: 31.2304,
        color: "#2563eb",
        icon: "Users",
      },
    ]);
  });

  it("falls back to an uncategorized marker style", () => {
    expect(buildMapMarkerItems([buildMarker({ categoryId: null })], [])).toMatchObject([
      {
        color: "#64748b",
        icon: "MapPin",
      },
    ]);
  });

  it("resolves selected marker records from the current filtered marker set", () => {
    const visibleMarker = buildMarker({ id: "visible-marker" });
    const hiddenMarker = buildMarker({ id: "hidden-marker" });

    expect(findMarkerById([visibleMarker], "visible-marker")).toBe(visibleMarker);
    expect(findMarkerById([visibleMarker], hiddenMarker.id)).toBeNull();
  });
});

function buildMarker(overrides: Partial<MarkerRecord>): MarkerRecord {
  return {
    id: "marker-1",
    projectId: "project-1",
    name: "客户点位",
    lng: 121.4737,
    lat: 31.2304,
    coordinateSystem: "BD09",
    address: null,
    categoryId: null,
    tagIds: [],
    note: null,
    source: "manual",
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
    ...overrides,
  };
}

function buildCategory(): CategoryRecord {
  return {
    id: "customer",
    projectId: "project-1",
    name: "客户",
    color: "#2563eb",
    icon: "Users",
    sortOrder: 10,
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
  };
}
