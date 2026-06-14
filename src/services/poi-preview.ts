import type { BaiduPoiResult } from "@/services/baidu-poi-search-provider";
import type { MapPoiPreview } from "@/services/map-provider";

export function buildPoiPreview(poi: BaiduPoiResult): MapPoiPreview | null {
  const { lng, lat } = poi;

  if (lng === null || lat === null || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    id: poi.id,
    name: poi.name,
    lng,
    lat,
    address: poi.address,
    city: poi.city,
    source: "baidu",
  };
}

export function replacePoiPreview(_currentPreview: MapPoiPreview | null, poi: BaiduPoiResult) {
  return buildPoiPreview(poi);
}

export function cancelPoiPreview() {
  return null;
}
