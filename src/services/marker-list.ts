import type { MarkerRecord } from "@/types/marker";

export type MarkerCategoryFilter = "all" | "uncategorized" | string;
export type MarkerSortKey = "updatedDesc" | "createdDesc" | "nameAsc";

export interface MarkerListFilters {
  categoryId: MarkerCategoryFilter;
  tagId: "all" | string;
  sortKey: MarkerSortKey;
}

export interface MarkerListFilterOption {
  id: string;
  name: string;
}

export function filterAndSortMarkers(markers: MarkerRecord[], filters: MarkerListFilters) {
  return [...markers]
    .filter((marker) => matchesCategory(marker, filters.categoryId))
    .filter((marker) => filters.tagId === "all" || marker.tagIds.includes(filters.tagId))
    .sort((left, right) => compareMarkers(left, right, filters.sortKey));
}

export function buildMarkerFilterSummary(
  filters: MarkerListFilters,
  categories: MarkerListFilterOption[],
  tags: MarkerListFilterOption[],
) {
  const parts: string[] = [];

  if (filters.categoryId === "uncategorized") {
    parts.push("未分类");
  } else if (filters.categoryId !== "all") {
    parts.push(categories.find((category) => category.id === filters.categoryId)?.name ?? "指定分类");
  }

  if (filters.tagId !== "all") {
    parts.push(tags.find((tag) => tag.id === filters.tagId)?.name ?? "指定标签");
  }

  if (filters.sortKey !== "updatedDesc") {
    parts.push(getMarkerSortLabel(filters.sortKey));
  }

  return parts.length > 0 ? parts.join(" · ") : "全部点位 · 最近更新";
}

export function hasActiveMarkerFilters(filters: MarkerListFilters) {
  return filters.categoryId !== "all" || filters.tagId !== "all" || filters.sortKey !== "updatedDesc";
}

function getMarkerSortLabel(sortKey: MarkerSortKey) {
  switch (sortKey) {
    case "createdDesc":
      return "最近创建";
    case "nameAsc":
      return "名称 A-Z";
    case "updatedDesc":
      return "最近更新";
  }
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
