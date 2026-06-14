import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { MapMarkerItem } from "@/services/map-provider";

const UNCATEGORIZED_MARKER_COLOR = "#64748b";
const UNCATEGORIZED_MARKER_ICON = "MapPin";

export function buildMapMarkerItems(markers: MarkerRecord[], categories: CategoryRecord[]): MapMarkerItem[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return markers.map((marker) => {
    const category = marker.categoryId ? categoriesById.get(marker.categoryId) : null;

    return {
      id: marker.id,
      name: marker.name,
      lng: marker.lng,
      lat: marker.lat,
      color: category?.color ?? UNCATEGORIZED_MARKER_COLOR,
      icon: category?.icon ?? UNCATEGORIZED_MARKER_ICON,
    };
  });
}
