import type { MarkerRecord } from "@/types/marker";

export type MarkerCategoryFilter = "all" | "uncategorized" | string;
export type MarkerSortKey = "updatedDesc" | "createdDesc" | "nameAsc";

export interface MarkerListFilters {
  categoryId: MarkerCategoryFilter;
  tagId: "all" | string;
  sortKey: MarkerSortKey;
}

export function filterAndSortMarkers(markers: MarkerRecord[], filters: MarkerListFilters) {
  return [...markers]
    .filter((marker) => matchesCategory(marker, filters.categoryId))
    .filter((marker) => filters.tagId === "all" || marker.tagIds.includes(filters.tagId))
    .sort((left, right) => compareMarkers(left, right, filters.sortKey));
}

function matchesCategory(marker: MarkerRecord, categoryId: MarkerCategoryFilter) {
  if (categoryId === "all") {
    return true;
  }

  if (categoryId === "uncategorized") {
    return marker.categoryId === null;
  }

  return marker.categoryId === categoryId;
}

function compareMarkers(left: MarkerRecord, right: MarkerRecord, sortKey: MarkerSortKey) {
  switch (sortKey) {
    case "createdDesc":
      return compareDesc(left.createdAt, right.createdAt) || stableTieBreak(left, right);
    case "nameAsc":
      return left.name.localeCompare(right.name, "zh-Hans-CN") || stableTieBreak(left, right);
    case "updatedDesc":
      return compareDesc(left.updatedAt, right.updatedAt) || stableTieBreak(left, right);
  }
}

function compareDesc(left: string, right: string) {
  return right.localeCompare(left);
}

function stableTieBreak(left: MarkerRecord, right: MarkerRecord) {
  return left.id.localeCompare(right.id);
}
