import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

export interface MarkerOverviewSnapshot {
  markerCount: number;
  categoryCount: number;
  tagCount: number;
  recentMarkers: MarkerRecord[];
}

export function buildMarkerOverviewSnapshot(
  markers: MarkerRecord[],
  categories: CategoryRecord[],
  tags: TagRecord[],
  recentLimit = 3,
): MarkerOverviewSnapshot {
  return {
    markerCount: markers.length,
    categoryCount: categories.length,
    tagCount: tags.length,
    recentMarkers: markers
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, recentLimit),
  };
}
